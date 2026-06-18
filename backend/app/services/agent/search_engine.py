"""
Search Engine
Provides full-text search, filtering, and similarity search capabilities.
"""
import logging
from typing import List, Dict, Any, Optional
from uuid import UUID
from datetime import datetime
import re

logger = logging.getLogger(__name__)


class SearchEngine:
    """Document search and filtering engine"""
    
    def __init__(self, supabase_client):
        self.db = supabase_client
    
    async def full_text_search(
        self,
        user_id: UUID,
        query: str,
        search_type: str = 'all',
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Perform full-text search across documents.
        
        Args:
            user_id: User UUID
            query: Search query
            search_type: 'all', 'filename', 'content', 'tags'
            limit: Max results to return
            
        Returns:
            List of matching files with scores
        """
        start_time = datetime.now()
        results = []
        
        # Clean up query - remove quotes and extra whitespace
        query = query.strip().strip('"\'').strip()
        
        if not query:
            return {
                'results': [],
                'total': 0,
                'search_time_ms': 0
            }
        
        try:
            if search_type in ['all', 'filename']:
                # Search by filename
                filename_results = await self._search_by_filename(user_id, query, limit)
                results.extend(filename_results)
            
            if search_type in ['all', 'content']:
                # Search by file content
                content_results = await self._search_by_content(user_id, query, limit)
                results.extend(content_results)
            
            if search_type in ['all', 'tags']:
                # Search by tags
                tag_results = await self._search_by_tags(user_id, query, limit)
                results.extend(tag_results)
            
            # Remove duplicates and sort by score
            unique_results = self._deduplicate_results(results)
            unique_results.sort(key=lambda x: x['match_score'], reverse=True)
            
            search_time = (datetime.now() - start_time).total_seconds() * 1000
            
            return {
                'results': unique_results[:limit],
                'total': len(unique_results),
                'search_time_ms': int(search_time)
            }
        
        except Exception as e:
            logger.error(f"Search error: {str(e)}")
            return {
                'results': [],
                'total': 0,
                'search_time_ms': 0,
                'error': str(e)
            }
    
    async def _search_by_filename(
        self,
        user_id: UUID,
        query: str,
        limit: int
    ) -> List[Dict[str, Any]]:
        """Search files by filename with fuzzy matching"""
        try:
            # First: exact substring match (ILIKE)
            response = self.db.table('file_metadata') \
                .select('id, display_name, size_bytes, mime_type, created_at') \
                .eq('user_id', str(user_id)) \
                .ilike('display_name', f'%{query}%') \
                .order('created_at', desc=True) \
                .limit(limit) \
                .execute()
            
            results = []
            for file in response.data:
                filename_lower = file['display_name'].lower()
                query_lower = query.lower()
                
                if query_lower in filename_lower:
                    pos = filename_lower.index(query_lower)
                    score = 1.0 - (pos / max(len(filename_lower), 1))
                else:
                    score = 0.5
                
                results.append({
                    'file_id': file['id'],
                    'filename': file['display_name'],
                    'size': file['size_bytes'],
                    'match_score': score,
                    'match_type': 'filename',
                    'snippet': None,
                    'highlighted': self._highlight_text(file['display_name'], query)
                })
            
            # If no exact matches, try fuzzy matching
            if not results:
                results = await self._fuzzy_filename_search(user_id, query, limit)
            
            return results
        
        except Exception as e:
            logger.error(f"Filename search error: {str(e)}")
            return []
    
    async def _fuzzy_filename_search(
        self,
        user_id: UUID,
        query: str,
        limit: int
    ) -> List[Dict[str, Any]]:
        """Fuzzy filename search: handles typos and partial matches"""
        try:
            # Get all user files (limited to 200 for performance)
            response = self.db.table('file_metadata') \
                .select('id, display_name, size_bytes, mime_type, created_at') \
                .eq('user_id', str(user_id)) \
                .limit(200) \
                .execute()
            
            results = []
            query_lower = query.lower().strip()
            query_words = [w for w in re.split(r'[\s._\-]+', query_lower) if len(w) > 1]
            
            for file in response.data:
                filename = file['display_name']
                filename_lower = filename.lower()
                name_base = re.sub(r'\.[^.]+$', '', filename_lower)  # Remove extension
                
                score = 0.0
                
                # Word match: how many query words appear in filename
                if query_words:
                    word_matches = sum(1 for w in query_words if w in filename_lower)
                    if word_matches > 0:
                        score = max(score, word_matches / len(query_words) * 0.8)
                
                # Character-level fuzzy: Levenshtein-like ratio
                similarity = self._string_similarity(query_lower, name_base)
                if similarity > 0.5:
                    score = max(score, similarity * 0.9)
                
                # Subsequence match: all query chars appear in order
                if self._is_subsequence(query_lower, filename_lower):
                    score = max(score, 0.6)
                
                if score >= 0.4:
                    results.append({
                        'file_id': file['id'],
                        'filename': filename,
                        'size': file['size_bytes'],
                        'match_score': score,
                        'match_type': 'fuzzy',
                        'snippet': None,
                        'highlighted': filename
                    })
            
            # Sort by score, return top matches
            results.sort(key=lambda x: x['match_score'], reverse=True)
            return results[:limit]
        
        except Exception as e:
            logger.error(f"Fuzzy search error: {str(e)}")
            return []
    
    @staticmethod
    def _string_similarity(s1: str, s2: str) -> float:
        """Calculate similarity ratio between two strings (0.0 to 1.0)"""
        if not s1 or not s2:
            return 0.0
        if s1 == s2:
            return 1.0
        
        # Simple character overlap ratio (faster than full Levenshtein)
        len1, len2 = len(s1), len(s2)
        if abs(len1 - len2) > max(len1, len2) * 0.5:
            return 0.0
        
        matches = 0
        s2_chars = list(s2)
        for c in s1:
            if c in s2_chars:
                matches += 1
                s2_chars.remove(c)
        
        return (2.0 * matches) / (len1 + len2)
    
    @staticmethod
    def _is_subsequence(query: str, text: str) -> bool:
        """Check if query chars appear in text in order"""
        qi = 0
        for c in text:
            if qi < len(query) and c == query[qi]:
                qi += 1
        return qi == len(query)
    
    async def _search_by_content(
        self,
        user_id: UUID,
        query: str,
        limit: int
    ) -> List[Dict[str, Any]]:
        """Search files by content using PostgreSQL full-text search"""
        try:
            # Use PostgreSQL's full-text search
            response = self.db.rpc(
                'search_file_content',
                {
                    'search_query': query,
                    'p_user_id': str(user_id),
                    'result_limit': limit
                }
            ).execute()
            
            results = []
            for row in response.data:
                results.append({
                    'file_id': row['file_id'],
                    'filename': row['filename'],
                    'match_score': row['rank'],
                    'match_type': 'content',
                    'snippet': row['snippet'],
                    'highlighted': self._highlight_text(row['snippet'], query)
                })
            
            return results
        
        except Exception as e:
            logger.error(f"Content search error: {str(e)}")
            # Fallback: Manual search through extracted text
            return await self._fallback_content_search(user_id, query, limit)
    
    async def _fallback_content_search(
        self,
        user_id: UUID,
        query: str,
        limit: int
    ) -> List[Dict[str, Any]]:
        """Fallback content search without full-text index"""
        try:
            # Get files with extracted text
            response = self.db.table('file_extracted_text') \
                .select('file_id, text, file_metadata(id, display_name)') \
                .execute()
            
            results = []
            query_lower = query.lower()
            
            for row in response.data:
                text = row['text'].lower()
                if query_lower in text:
                    # Find snippet around match
                    pos = text.index(query_lower)
                    start = max(0, pos - 100)
                    end = min(len(text), pos + 100)
                    snippet = row['text'][start:end]
                    
                    # Calculate score based on frequency
                    frequency = text.count(query_lower)
                    score = min(frequency / 10, 1.0)  # Cap at 1.0
                    
                    file_meta = row.get('file_metadata', {})
                    results.append({
                        'file_id': row['file_id'],
                        'filename': file_meta.get('display_name', 'Unknown'),
                        'match_score': score,
                        'match_type': 'content',
                        'snippet': snippet,
                        'highlighted': self._highlight_text(snippet, query)
                    })
            
            # Sort by score and limit
            results.sort(key=lambda x: x['match_score'], reverse=True)
            return results[:limit]
        
        except Exception as e:
            logger.error(f"Fallback content search error: {str(e)}")
            return []
    
    async def _search_by_tags(
        self,
        user_id: UUID,
        query: str,
        limit: int
    ) -> List[Dict[str, Any]]:
        """Search files by tags"""
        try:
            # Tags are stored as JSONB array in file_metadata
            response = self.db.table('file_metadata') \
                .select('id, display_name, tags, created_at') \
                .eq('user_id', str(user_id)) \
                .not_.is_('tags', 'null') \
                .limit(limit * 2) \
                .execute()
            
            results = []
            query_lower = query.lower()
            
            for file in response.data:
                tags = file.get('tags', [])
                if not tags:
                    continue
                
                # Check if any tag matches
                matching_tags = [tag for tag in tags if query_lower in tag.lower()]
                if matching_tags:
                    score = len(matching_tags) / len(tags)
                    results.append({
                        'file_id': file['id'],
                        'filename': file.get('display_name', 'Unknown'),
                        'match_score': score,
                        'match_type': 'tags',
                        'snippet': f"Tags: {', '.join(matching_tags)}",
                        'highlighted': f"Tags: {', '.join(matching_tags)}"
                    })
            
            return results[:limit]
        
        except Exception as e:
            logger.error(f"Tag search error: {str(e)}")
            return []
    
    def _deduplicate_results(self, results: List[Dict]) -> List[Dict]:
        """Remove duplicate results, keeping highest score"""
        seen = {}
        for result in results:
            file_id = result['file_id']
            if file_id not in seen or result['match_score'] > seen[file_id]['match_score']:
                seen[file_id] = result
        return list(seen.values())
    
    def _highlight_text(self, text: str, query: str, max_length: int = 200) -> str:
        """Highlight query matches in text"""
        if not text:
            return ""
        
        # Truncate if too long
        if len(text) > max_length:
            text = text[:max_length] + '...'
        
        # Simple highlight with **bold** markers
        pattern = re.compile(f'({re.escape(query)})', re.IGNORECASE)
        highlighted = pattern.sub(r'**\1**', text)
        
        return highlighted
    
    async def get_similar_files(
        self,
        user_id: UUID,
        file_id: UUID,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Find files similar to the given file based on keywords"""
        try:
            # Get keywords for the source file
            source_keywords = self.db.table('file_keywords') \
                .select('keyword, score') \
                .eq('file_id', str(file_id)) \
                .order('score', desc=True) \
                .limit(10) \
                .execute()
            
            if not source_keywords.data:
                return []
            
            # Get top keywords
            top_keywords = [kw['keyword'] for kw in source_keywords.data[:5]]
            
            # Find other files with similar keywords
            similar_files = []
            for keyword in top_keywords:
                response = self.db.table('file_keywords') \
                    .select('file_id') \
                    .eq('keyword', keyword) \
                    .neq('file_id', str(file_id)) \
                    .execute()
                
                similar_files.extend(response.data)
            
            # Count matches per file
            file_counts = {}
            for item in similar_files:
                fid = item['file_id']
                file_counts[fid] = file_counts.get(fid, 0) + 1
            
            # Sort by match count
            sorted_files = sorted(
                file_counts.items(),
                key=lambda x: x[1],
                reverse=True
            )[:limit]
            
            # Build result
            results = []
            for fid, count in sorted_files:
                # Get file metadata
                try:
                    file_meta = self.db.table('file_metadata') \
                        .select('id, display_name, mime_type, size_bytes') \
                        .eq('id', fid) \
                        .single() \
                        .execute()
                    
                    if file_meta.data:
                        results.append({
                            'file_id': fid,
                            'filename': file_meta.data.get('display_name', 'Unknown'),
                            'similarity_score': count / len(top_keywords),
                            'common_keywords': count
                        })
                except Exception:
                    pass
            
            return results
        
        except Exception as e:
            logger.error(f"Similar files error: {str(e)}")
            return []


# Factory function to create search engine instance
def create_search_engine(supabase_client):
    return SearchEngine(supabase_client)
