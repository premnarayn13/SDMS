"""
Main Agent Service
Coordinates all agent capabilities and handles chat interactions.
"""
import logging
from typing import Dict, Any, Optional, List
from uuid import UUID
from datetime import datetime
import asyncio

from .voice_commands import voice_parser
from .text_extractor import text_extractor
from .nlp_service import nlp_service
from .search_engine import create_search_engine
from .analytics import create_analytics_service
from .schemas import *

logger = logging.getLogger(__name__)


class AgentService:
    """
    Main Docky Agent Service
    Provides 200+ document management features without LLM dependencies.
    """
    
    def __init__(self, supabase_client):
        self.db = supabase_client
        self.search_engine = create_search_engine(supabase_client)
        self.analytics = create_analytics_service(supabase_client)
    
    # =====================================================
    # CHAT & VOICE COMMANDS
    # =====================================================
    
    async def process_chat_message(
        self,
        user_id: UUID,
        message: str,
        is_voice: bool = False
    ) -> ChatResponse:
        """
        Process user chat message and execute appropriate command.
        
        Args:
            user_id: User UUID
            message: User message text
            is_voice: Whether message is from voice input
            
        Returns:
            ChatResponse with results and suggestions
        """
        try:
            # Save user message to history
            await self._save_chat_history(user_id, message, 'user')
            
            # Parse command
            if is_voice:
                command = voice_parser.parse(message)
            else:
                command = self._parse_text_command(message)
            
            # Execute command
            result = await self._execute_command(user_id, command)
            
            # Extract action_data if present in result
            action_data = None
            if result and isinstance(result, dict) and 'action_data' in result:
                action_data = result.pop('action_data')
            
            # Generate response message
            response_text = self._generate_response_text(command, result)
            
            # Get suggestions
            suggestions = voice_parser.get_suggestions(message)
            
            # Save assistant response
            await self._save_chat_history(
                user_id,
                response_text,
                'assistant',
                command_type=command.get('command'),
                results=result
            )
            
            return ChatResponse(
                message=response_text,
                command_type=command.get('command'),
                results=result,
                action_data=action_data,
                suggestions=suggestions
            )
        
        except Exception as e:
            logger.error(f"Chat processing error: {str(e)}")
            return ChatResponse(
                message=f"Sorry, I encountered an error: {str(e)}",
                command_type='error'
            )
    
    async def _execute_command(
        self,
        user_id: UUID,
        command: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Execute parsed command"""
        cmd_type = command.get('command')
        params = command.get('params', {})
        
        # Route to appropriate handler
        if cmd_type == 'search':
            return await self._handle_search(user_id, params)
        elif cmd_type == 'open':
            return await self._handle_open(user_id, params)
        elif cmd_type == 'delete':
            return await self._handle_delete(user_id, params)
        elif cmd_type == 'rename':
            return await self._handle_rename(user_id, params)
        elif cmd_type == 'favorite':
            return await self._handle_favorite(user_id, params)
        elif cmd_type == 'tag':
            return await self._handle_tag(user_id, params)
        elif cmd_type == 'move':
            return await self._handle_move(user_id, params)
        elif cmd_type == 'download':
            return await self._handle_download(user_id, params)
        elif cmd_type == 'analytics':
            return await self._handle_analytics(user_id, params)
        elif cmd_type == 'storage':
            return await self._handle_storage(user_id)
        elif cmd_type == 'recent':
            return await self._handle_recent(user_id)
        elif cmd_type == 'duplicates':
            return await self._handle_duplicates(user_id)
        elif cmd_type == 'upload':
            return {'action': 'trigger_upload'}
        elif cmd_type == 'help':
            return self._handle_help()
        elif cmd_type == 'greet':
            return self._handle_greet()
        else:
            return {'action': command.get('action'), 'params': params}
    
    async def _handle_open(
        self,
        user_id: UUID,
        params: Dict
    ) -> Dict[str, Any]:
        """Handle open file command - search for the file and return view URL"""
        query = params.get('query', '')
        # Strip quotes from query
        query = query.strip('"\'')
        results = await self.search_engine.full_text_search(user_id, query, search_type='filename', limit=5)
        
        if results.get('total', 0) > 0:
            top_file = results['results'][0]
            file_id = top_file['file_id']
            # Try to get view URL
            try:
                file_data = self.db.table('file_metadata') \
                    .select('id, display_name, drive_file_id, mime_type') \
                    .eq('id', file_id) \
                    .single() \
                    .execute()
                
                if file_data.data and file_data.data.get('drive_file_id'):
                    view_url = f"https://drive.google.com/file/d/{file_data.data['drive_file_id']}/view"
                    results['view_url'] = view_url
                    results['file_name'] = file_data.data['display_name']
                    results['action_data'] = {
                        'file_id': file_id,
                        'filename': file_data.data['display_name'],
                        'view_url': view_url
                    }
            except Exception as e:
                logger.error(f"Open file error: {e}")
        
        return results

    async def _find_file_by_name(self, user_id: UUID, query: str) -> Optional[Dict]:
        """Find a file by name with fuzzy matching"""
        query = query.strip().strip('"\'')
        # Clean common prefixes
        query = query.replace('the file ', '').replace('file ', '').strip()
        if not query:
            return None
        
        # Try exact match first
        try:
            response = self.db.table('file_metadata') \
                .select('id, display_name, mime_type, size_bytes, drive_file_id') \
                .eq('user_id', str(user_id)) \
                .ilike('display_name', query) \
                .limit(1) \
                .execute()
            if response.data:
                return response.data[0]
        except Exception:
            pass
        
        # Try contains match
        try:
            response = self.db.table('file_metadata') \
                .select('id, display_name, mime_type, size_bytes, drive_file_id') \
                .eq('user_id', str(user_id)) \
                .ilike('display_name', f'%{query}%') \
                .limit(5) \
                .execute()
            if response.data:
                # Return best match (shortest name that contains query)
                return min(response.data, key=lambda f: len(f['display_name']))
        except Exception:
            pass
        
        # Try without extension if provided
        if '.' in query:
            base_name = query.rsplit('.', 1)[0]
            try:
                response = self.db.table('file_metadata') \
                    .select('id, display_name, mime_type, size_bytes, drive_file_id') \
                    .eq('user_id', str(user_id)) \
                    .ilike('display_name', f'{base_name}%') \
                    .limit(5) \
                    .execute()
                if response.data:
                    return response.data[0]
            except Exception:
                pass
        
        # Fuzzy: try with each word
        words = query.lower().split()
        if len(words) > 1:
            for word in words:
                if len(word) < 3:
                    continue
                try:
                    response = self.db.table('file_metadata') \
                        .select('id, display_name, mime_type, size_bytes, drive_file_id') \
                        .eq('user_id', str(user_id)) \
                        .ilike('display_name', f'%{word}%') \
                        .limit(5) \
                        .execute()
                    if response.data:
                        return response.data[0]
                except Exception:
                    pass
        
        return None

    async def _handle_delete(self, user_id: UUID, params: Dict) -> Dict[str, Any]:
        """Handle delete file command - find file and return action_data for frontend"""
        query = params.get('query', '')
        file_info = await self._find_file_by_name(user_id, query)
        
        if file_info:
            return {
                'action': 'delete',
                'action_data': {
                    'file_id': file_info['id'],
                    'filename': file_info['display_name']
                },
                'found': True
            }
        return {'found': False, 'query': query}

    async def _handle_rename(self, user_id: UUID, params: Dict) -> Dict[str, Any]:
        """Handle rename file command"""
        old_name = params.get('old_name', '')
        new_name = params.get('new_name', '')
        
        file_info = await self._find_file_by_name(user_id, old_name)
        
        if file_info and new_name:
            return {
                'action': 'rename',
                'action_data': {
                    'file_id': file_info['id'],
                    'old_name': file_info['display_name'],
                    'new_name': new_name
                },
                'found': True
            }
        return {'found': False, 'query': old_name}

    async def _handle_favorite(self, user_id: UUID, params: Dict) -> Dict[str, Any]:
        """Handle favorite/unfavorite file command"""
        query = params.get('query', '') or params.get('file', '')
        file_info = await self._find_file_by_name(user_id, query)
        
        if file_info:
            return {
                'action': 'favorite',
                'action_data': {
                    'file_id': file_info['id'],
                    'filename': file_info['display_name']
                },
                'found': True
            }
        return {'found': False, 'query': query}

    async def _handle_tag(self, user_id: UUID, params: Dict) -> Dict[str, Any]:
        """Handle tag file command"""
        filename = params.get('file', '')
        tag = params.get('tag', '')
        
        file_info = await self._find_file_by_name(user_id, filename)
        
        if file_info and tag:
            return {
                'action': 'tag',
                'action_data': {
                    'file_id': file_info['id'],
                    'filename': file_info['display_name'],
                    'tag': tag
                },
                'found': True
            }
        return {'found': False, 'query': filename}

    async def _handle_move(self, user_id: UUID, params: Dict) -> Dict[str, Any]:
        """Handle move file command"""
        filename = params.get('file', '')
        destination = params.get('destination', '')
        
        file_info = await self._find_file_by_name(user_id, filename)
        
        if file_info:
            return {
                'action': 'move',
                'action_data': {
                    'file_id': file_info['id'],
                    'filename': file_info['display_name'],
                    'destination': destination
                },
                'found': True
            }
        return {'found': False, 'query': filename}

    async def _handle_download(self, user_id: UUID, params: Dict) -> Dict[str, Any]:
        """Handle download file command"""
        query = params.get('query', '')
        file_info = await self._find_file_by_name(user_id, query)
        
        if file_info:
            return {
                'action': 'download',
                'action_data': {
                    'file_id': file_info['id'],
                    'filename': file_info['display_name']
                },
                'found': True
            }
        return {'found': False, 'query': query}

    async def _handle_search(
        self,
        user_id: UUID,
        params: Dict
    ) -> Dict[str, Any]:
        """Handle search command"""
        query = params.get('query', '')
        results = await self.search_engine.full_text_search(user_id, query, limit=10)
        return results
    
    async def _handle_analytics(
        self,
        user_id: UUID,
        params: Dict
    ) -> Dict[str, Any]:
        """Handle analytics command"""
        period = params.get('period', '7d')
        analytics = await self.analytics.get_dashboard_analytics(user_id, period)
        return analytics
    
    async def _handle_storage(self, user_id: UUID) -> Dict[str, Any]:
        """Handle storage usage command"""
        # Get all drives
        drives = self.db.table('google_drive_tokens') \
            .select('id, display_name, allocated_storage_bytes') \
            .eq('user_id', str(user_id)) \
            .execute()
        
        storage_info = []
        total_used = 0
        total_allocated = 0
        
        for drive in drives.data:
            # Get files for this drive
            files = self.db.table('file_metadata') \
                .select('size_bytes') \
                .eq('drive_id', drive['id']) \
                .execute()
            
            used = sum(f['size_bytes'] for f in files.data)
            allocated = drive.get('allocated_storage_bytes', 0)
            
            storage_info.append({
                'drive_name': drive['display_name'],
                'used_bytes': used,
                'used_gb': round(used / (1024**3), 2),
                'allocated_bytes': allocated,
                'allocated_gb': round(allocated / (1024**3), 2),
                'percentage': round((used / allocated * 100), 1) if allocated > 0 else 0
            })
            
            total_used += used
            total_allocated += allocated
        
        return {
            'drives': storage_info,
            'total_used_gb': round(total_used / (1024**3), 2),
            'total_allocated_gb': round(total_allocated / (1024**3), 2),
            'total_percentage': round((total_used / total_allocated * 100), 1) if total_allocated > 0 else 0
        }
    
    async def _handle_recent(self, user_id: UUID) -> Dict[str, Any]:
        """Handle recent files command"""
        response = self.db.table('file_metadata') \
            .select('id, display_name, size_bytes, mime_type, created_at') \
            .eq('user_id', str(user_id)) \
            .order('created_at', desc=True) \
            .limit(10) \
            .execute()
        
        # Map field names to expected format
        files = []
        for file in response.data:
            files.append({
                'id': file['id'],
                'filename': file['display_name'],
                'size': file['size_bytes'],
                'mime_type': file['mime_type'],
                'created_at': file['created_at']
            })
        
        return {
            'files': files,
            'count': len(files)
        }
    
    async def _handle_duplicates(self, user_id: UUID) -> Dict[str, Any]:
        """Handle find duplicates command using checksum-based detection"""
        try:
            # Get all files with their checksums
            response = self.db.table('file_metadata') \
                .select('id, display_name, size_bytes, checksum_sha256, mime_type') \
                .eq('user_id', str(user_id)) \
                .eq('is_trashed', False) \
                .execute()
            
            files = response.data
            if not files:
                return {
                    'message': 'No files found to check for duplicates.',
                    'duplicates': [],
                    'total_groups': 0,
                    'space_wasted': 0
                }
            
            # Group by checksum (exact duplicates)
            checksum_groups = {}
            for f in files:
                checksum = f.get('checksum_sha256')
                if checksum:
                    if checksum not in checksum_groups:
                        checksum_groups[checksum] = []
                    checksum_groups[checksum].append(f)
            
            # Also group by size + name similarity (near duplicates)
            size_groups = {}
            for f in files:
                size = f.get('size_bytes', 0)
                if size and size > 0:
                    key = str(size)
                    if key not in size_groups:
                        size_groups[key] = []
                    size_groups[key].append(f)
            
            # Build duplicate groups (files sharing same checksum)
            duplicate_groups = []
            space_wasted = 0
            
            for checksum, group_files in checksum_groups.items():
                if len(group_files) > 1:
                    group_size = sum(f.get('size_bytes', 0) for f in group_files)
                    wasted = group_size - (group_files[0].get('size_bytes', 0) if group_files else 0)
                    space_wasted += wasted
                    
                    duplicate_groups.append({
                        'hash': checksum,
                        'files': [{
                            'id': f['id'],
                            'filename': f.get('display_name', 'Unknown'),
                            'size': f.get('size_bytes', 0),
                            'mime_type': f.get('mime_type', 'unknown')
                        } for f in group_files],
                        'file_count': len(group_files),
                        'total_size': group_size,
                        'wasted_bytes': wasted
                    })
            
            # Also find near-duplicates (same size, similar names)
            for size_key, group_files in size_groups.items():
                if len(group_files) > 1:
                    # Check if already in checksum groups
                    checksums_in_group = set(f.get('checksum_sha256') for f in group_files if f.get('checksum_sha256'))
                    already_found = any(cs in checksum_groups and len(checksum_groups[cs]) > 1 for cs in checksums_in_group)
                    
                    if not already_found:
                        # Check name similarity
                        names = [f.get('display_name', '').lower() for f in group_files]
                        from difflib import SequenceMatcher
                        for i in range(len(names)):
                            for j in range(i + 1, len(names)):
                                ratio = SequenceMatcher(None, names[i], names[j]).ratio()
                                if ratio > 0.7:
                                    group_size = group_files[i].get('size_bytes', 0) + group_files[j].get('size_bytes', 0)
                                    duplicate_groups.append({
                                        'hash': f'size_{size_key}_similar',
                                        'files': [{
                                            'id': group_files[k]['id'],
                                            'filename': group_files[k].get('display_name', 'Unknown'),
                                            'size': group_files[k].get('size_bytes', 0),
                                            'mime_type': group_files[k].get('mime_type', 'unknown')
                                        } for k in [i, j]],
                                        'file_count': 2,
                                        'total_size': group_size,
                                        'wasted_bytes': min(group_files[i].get('size_bytes', 0), group_files[j].get('size_bytes', 0)),
                                        'match_type': 'similar_name'
                                    })
                                    break
            
            total_groups = len(duplicate_groups)
            total_dupes = sum(g['file_count'] for g in duplicate_groups)
            
            def format_size(size_bytes):
                if size_bytes >= 1024**3:
                    return f"{size_bytes / 1024**3:.1f} GB"
                elif size_bytes >= 1024**2:
                    return f"{size_bytes / 1024**2:.1f} MB"
                elif size_bytes >= 1024:
                    return f"{size_bytes / 1024:.1f} KB"
                return f"{size_bytes} B"
            
            if total_groups > 0:
                msg = f"Found {total_groups} duplicate group(s) with {total_dupes} files. You could save {format_size(space_wasted)} by removing duplicates."
            else:
                msg = "No duplicate files found. Your files are all unique!"
            
            return {
                'message': msg,
                'duplicates': duplicate_groups,
                'total_groups': total_groups,
                'total_duplicate_files': total_dupes,
                'space_wasted': space_wasted,
                'space_wasted_readable': format_size(space_wasted)
            }
        
        except Exception as e:
            logger.error(f"Duplicate detection error: {str(e)}")
            return {
                'message': f'Error checking for duplicates: {str(e)}',
                'duplicates': [],
                'total_groups': 0,
                'space_wasted': 0
            }
    
    def _handle_help(self) -> Dict[str, Any]:
        """Handle help command - COMPREHENSIVE feature list"""
        commands = [
            {
                'category': '📁 File Operations (10 features)',
                'commands': [
                    'Open [filename]',
                    'Download [filename]', 
                    'Upload a file',
                    'Delete [filename]',
                    'Rename [old name] to [new name]',
                    'View [filename]',
                    'Launch [filename]',
                    'Read [filename]',
                    'Display [filename]',
                    'Get file [filename]'
                ]
            },
            {
                'category': '🗂️ Organization (12 features)',
                'commands': [
                    'Favorite [filename]',
                    'Unfavorite [filename]',
                    'Star [filename]',
                    'Tag [filename] with [tag]',
                    'Add tag [tag] to [filename]',
                    'Label [filename] as [tag]',
                    'Move [filename] to [folder]',
                    'Transfer [filename] to [folder]',
                    'Show recent files',
                    'Find duplicates',
                    'Organize my files',
                    'Clean up my files'
                ]
            },
            {
                'category': '🔍 Search & Filter (15 features)',
                'commands': [
                    'Search for [query]',
                    'Find [filename]',
                    'Look for [query]',
                    'Where is [filename]',
                    'Show files with tag [tag]',
                    'Filter by [criteria]',
                    'Show only [type]',
                    'Search by filename [query]',
                    'Search by content [query]',
                    'Search by tags [query]',
                    'Full-text search [query]',
                    'Find exact match [query]',
                    'Find similar files',
                    'Show all PDFs',
                    'Show all documents'
                ]
            },
            {
                'category': '📊 Analytics & Insights (10 features)',
                'commands': [
                    'Show analytics',
                    'Show analytics dashboard',
                    'How much storage?',
                    'Show statistics',
                    'Show stats',
                    'What are my stats',
                    'How many files',
                    'Storage usage',
                    'Space used',
                    'Check storage'
                ]
            },
            {
                'category': '🤖 AI & NLP Features (15 features)',
                'commands': [
                    'Extract entities from [filename]',
                    'Find people in [filename]',
                    'Find organizations in [filename]',
                    'Find dates in [filename]',
                    'Extract keywords from [filename]',
                    'What language is [filename]',
                    'Detect language [filename]',
                    'Summarize [filename]',
                    'Get file statistics',
                    'Count words in [filename]',
                    'Analyze [filename]',
                    'Get insights from [filename]',
                    'Extract text from [filename]',
                    'Parse [filename]',
                    'Process [filename]'
                ]
            },
            {
                'category': '🔄 Duplicate Management (6 features)',
                'commands': [
                    'Find duplicates',
                    'Find duplicate files',
                    'Show duplicates',
                    'Check for duplicates',
                    'Remove duplicates',
                    'Clean duplicate files'
                ]
            },
            {
                'category': '⏱️ Recent & History (5 features)',
                'commands': [
                    'Show recent files',
                    'Latest files',
                    'What did I upload recently',
                    'Recently uploaded files',
                    'My recent files'
                ]
            },
            {
                'category': '💬 Greetings & Help (8 features)',
                'commands': [
                    'Help',
                    'What can you do',
                    'Show commands',
                    'Hi Docky',
                    'Hello',
                    'Hey',
                    'Good morning',
                    'Thanks'
                ]
            }
        ]
        
        # Count total features
        total_features = sum(len(cat['commands']) for cat in commands)
        
        return {
            'commands': commands,
            'total_features': total_features,
            'feature_categories': len(commands)
        }
    
    def _handle_greet(self) -> Dict[str, Any]:
        """Handle greeting"""
        return {
            'greeting': True,
            'message': 'Hello! I\'m Docky, your AI document assistant. How can I help you today?'
        }
    
    def _parse_text_command(self, text: str) -> Dict[str, Any]:
        """Parse text command (uses same parser as voice)"""
        return voice_parser.parse(text)
    
    def _generate_response_text(
        self,
        command: Dict[str, Any],
        result: Optional[Dict[str, Any]]
    ) -> str:
        """Generate human-readable response text"""
        cmd_type = command.get('command')
        params = command.get('params', {})
        
        if cmd_type == 'search':
            count = result.get('total', 0) if result else 0
            return f"Found {count} files matching your search."
        
        elif cmd_type == 'open':
            if result and result.get('total', 0) > 0:
                file_name = result.get('file_name', result['results'][0]['filename'])
                return f"Found \"{file_name}\". Opening it for you now."
            return "Sorry, I couldn't find that file. Try checking the filename."
        
        elif cmd_type == 'delete':
            if result and result.get('found'):
                fname = result.get('action_data', {}).get('filename', params.get('query', ''))
                return f"Moving \"{fname}\" to trash."
            return f"Sorry, I couldn't find a file matching \"{params.get('query', '')}\". Please check the name."
        
        elif cmd_type == 'rename':
            if result and result.get('found'):
                old = result.get('action_data', {}).get('old_name', params.get('old_name', ''))
                new = params.get('new_name', '')
                return f"Renaming \"{old}\" to \"{new}\"."
            return f"Sorry, I couldn't find \"{params.get('old_name', '')}\". Please check the filename."
        
        elif cmd_type == 'favorite':
            if result and result.get('found'):
                fname = result.get('action_data', {}).get('filename', params.get('query', ''))
                return f"Toggling favorite for \"{fname}\"."
            return f"Sorry, I couldn't find that file to favorite."
        
        elif cmd_type == 'tag':
            if result and result.get('found'):
                fname = result.get('action_data', {}).get('filename', params.get('file', ''))
                tag = params.get('tag', '')
                return f"Adding tag \"{tag}\" to \"{fname}\"."
            return f"Sorry, I couldn't find that file to tag."
        
        elif cmd_type == 'move':
            if result and result.get('found'):
                fname = result.get('action_data', {}).get('filename', params.get('file', ''))
                dest = params.get('destination', '')
                return f"Moving \"{fname}\" to \"{dest}\"."
            return f"Sorry, I couldn't find that file to move."
        
        elif cmd_type == 'download':
            if result and result.get('found'):
                fname = result.get('action_data', {}).get('filename', params.get('query', ''))
                return f"Starting download of \"{fname}\"."
            return f"Sorry, I couldn't find that file to download."
        
        elif cmd_type == 'upload':
            return "Opening the upload dialog for you."
        
        elif cmd_type == 'analytics':
            if result:
                stats = result.get('file_stats', {})
                total = stats.get('total_files', 0)
                return f"You have {total} files in your system. Check the analytics dashboard for details."
            return "Analytics data retrieved."
        
        elif cmd_type == 'storage':
            if result:
                total_gb = result.get('total_used_gb', 0)
                return f"You're using {total_gb} GB of storage across your drives."
            return "Storage information retrieved."
        
        elif cmd_type == 'recent':
            count = result.get('count', 0) if result else 0
            return f"Here are your {count} most recent files."
        
        elif cmd_type == 'duplicates':
            return result.get('message', 'Finding duplicate files...')
        
        elif cmd_type == 'help':
            return "Here are the commands I understand. Try saying any of these!"
        
        elif cmd_type == 'greet':
            return result.get('message', 'Hello!')
        
        else:
            return command.get('action', 'Command executed.')
    
    async def _save_chat_history(
        self,
        user_id: UUID,
        message: str,
        role: str,
        command_type: Optional[str] = None,
        results: Optional[Dict] = None
    ):
        """Save chat message to history"""
        try:
            self.db.table('agent_chat_history').insert({
                'user_id': str(user_id),
                'message': message,
                'role': role,
                'command_type': command_type,
                'results': results
            }).execute()
        except Exception as e:
            logger.error(f"Failed to save chat history: {str(e)}")

    async def save_autonomous_execution(
        self,
        user_id: UUID,
        user_message: str,
        execution_response: Dict[str, Any]
    ):
        """Persist autonomous user request + assistant execution response in chat history."""
        try:
            await self._save_chat_history(
                user_id=user_id,
                message=user_message,
                role='user',
                command_type='autonomous_request',
                results=None
            )

            results_payload = {
                'status': execution_response.get('status'),
                'actions_executed': execution_response.get('actions_executed', []),
                'tool_calls_count': execution_response.get('tool_calls_count', 0),
                'successful_count': execution_response.get('successful_count', 0),
                'error': execution_response.get('error')
            }

            await self._save_chat_history(
                user_id=user_id,
                message=execution_response.get('message', 'Task completed.'),
                role='assistant',
                command_type='autonomous',
                results=results_payload
            )
        except Exception as e:
            logger.error(f"Failed to save autonomous execution history: {str(e)}")
    
    # =====================================================
    # FILE INTELLIGENCE
    # =====================================================
    
    async def process_file_upload(
        self,
        user_id: UUID,
        file_id: UUID,
        filename: str,
        file_content: bytes
    ) -> Dict[str, Any]:
        """
        Process uploaded file: extract text, entities, keywords.
        
        Args:
            user_id: User UUID
            file_id: File UUID
            filename: Original filename
            file_content: File bytes
            
        Returns:
            Processing results
        """
        try:
            results = {
                'file_id': str(file_id),
                'filename': filename,
                'processed': False
            }
            
            # Check if file type is supported for text extraction
            if not text_extractor.is_supported(filename):
                results['message'] = 'File type not supported for text extraction'
                return results
            
            # Extract text
            extracted_text, error = text_extractor.extract(file_content, filename)
            if error:
                results['error'] = error
                return results
            
            if not extracted_text or len(extracted_text) < 10:
                results['message'] = 'No extractable text found'
                return results
            
            # Save extracted text
            await self._save_extracted_text(file_id, extracted_text)
            
            # Extract entities
            entities = nlp_service.extract_entities(extracted_text)
            if entities:
                await self._save_entities(file_id, entities)
            
            # Extract keywords
            keywords = nlp_service.extract_keywords(extracted_text)
            if keywords:
                await self._save_keywords(file_id, keywords)
            
            # Detect language
            language = nlp_service.detect_language(extracted_text)
            
            results.update({
                'processed': True,
                'text_length': len(extracted_text),
                'entity_count': len(entities),
                'keyword_count': len(keywords),
                'language': language
            })
            
            # Log activity
            await self._log_activity(user_id, 'file_processed', 'file', file_id)
            
            return results
        
        except Exception as e:
            logger.error(f"File processing error: {str(e)}")
            return {
                'file_id': str(file_id),
                'processed': False,
                'error': str(e)
            }
    
    async def _save_extracted_text(
        self,
        file_id: UUID,
        text: str
    ):
        """Save extracted text to database"""
        stats = nlp_service.get_text_stats(text)
        language = nlp_service.detect_language(text)
        
        self.db.table('file_extracted_text').upsert({
            'file_id': str(file_id),
            'text': text,
            'language': language,
            'word_count': stats['word_count'],
            'char_count': stats['char_count']
        }).execute()
    
    async def _save_entities(
        self,
        file_id: UUID,
        entities: List[Dict]
    ):
        """Save extracted entities to database"""
        # Delete old entities
        self.db.table('file_entities').delete().eq('file_id', str(file_id)).execute()
        
        # Insert new entities
        for entity in entities:
            self.db.table('file_entities').insert({
                'file_id': str(file_id),
                'entity_type': entity['type'],
                'entity_text': entity['text'],
                'confidence': entity['confidence'],
                'position': entity['position']
            }).execute()
    
    async def _save_keywords(
        self,
        file_id: UUID,
        keywords: List[Dict]
    ):
        """Save extracted keywords to database"""
        # Delete old keywords
        self.db.table('file_keywords').delete().eq('file_id', str(file_id)).execute()
        
        # Insert new keywords
        for keyword in keywords:
            self.db.table('file_keywords').insert({
                'file_id': str(file_id),
                'keyword': keyword['keyword'],
                'score': keyword['score'],
                'rank': keyword['rank']
            }).execute()
    
    async def _log_activity(
        self,
        user_id: UUID,
        action_type: str,
        target_type: Optional[str] = None,
        target_id: Optional[UUID] = None,
        metadata: Optional[Dict] = None
    ):
        """Log user activity"""
        try:
            self.db.table('activity_logs').insert({
                'user_id': str(user_id),
                'action_type': action_type,
                'target_type': target_type,
                'target_id': str(target_id) if target_id else None,
                'metadata': metadata
            }).execute()
        except Exception as e:
            logger.error(f"Activity logging error: {str(e)}")
    
    # =====================================================
    # CHAT HISTORY
    # =====================================================
    
    async def get_chat_history(
        self,
        user_id: UUID,
        limit: int = 50
    ) -> List[ChatHistoryItem]:
        """Get chat history for user"""
        try:
            response = self.db.table('agent_chat_history') \
                .select('*') \
                .eq('user_id', str(user_id)) \
                .order('created_at', desc=True) \
                .limit(limit) \
                .execute()

            normalized_items = []
            for item in response.data:
                results = item.get('results') if isinstance(item.get('results'), dict) else {}
                item['actions_executed'] = results.get('actions_executed') if isinstance(results, dict) else None
                item['status'] = results.get('status') if isinstance(results, dict) else None
                item['tool_calls_count'] = results.get('tool_calls_count', 0) if isinstance(results, dict) else 0
                item['successful_count'] = results.get('successful_count', 0) if isinstance(results, dict) else 0
                normalized_items.append(ChatHistoryItem(**item))

            return normalized_items
        
        except Exception as e:
            logger.error(f"Get chat history error: {str(e)}")
            return []

    async def get_action_history(
        self,
        user_id: UUID,
        limit: int = 50
    ) -> List[AgentActionLogItem]:
        """Get autonomous action execution logs as a dedicated list."""
        try:
            response = self.db.table('agent_chat_history') \
                .select('id, message, results, created_at') \
                .eq('user_id', str(user_id)) \
                .eq('role', 'assistant') \
                .eq('command_type', 'autonomous') \
                .order('created_at', desc=True) \
                .limit(limit) \
                .execute()

            logs: List[AgentActionLogItem] = []
            for item in response.data:
                results = item.get('results') if isinstance(item.get('results'), dict) else {}
                logs.append(AgentActionLogItem(
                    id=item['id'],
                    message=item.get('message') or 'Task completed.',
                    status=results.get('status') or 'completed',
                    actions_executed=results.get('actions_executed') or [],
                    tool_calls_count=results.get('tool_calls_count') or 0,
                    successful_count=results.get('successful_count') or 0,
                    created_at=item['created_at']
                ))

            return logs
        except Exception as e:
            logger.error(f"Get action history error: {str(e)}")
            return []
    
    async def clear_chat_history(self, user_id: UUID):
        """Clear chat history for user"""
        try:
            self.db.table('agent_chat_history') \
                .delete() \
                .eq('user_id', str(user_id)) \
                .execute()
        except Exception as e:
            logger.error(f"Clear chat history error: {str(e)}")
            raise
