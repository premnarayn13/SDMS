"""
NLP Service
Handles entity extraction, keyword extraction, and language detection.
Uses spaCy for lightweight NLP without LLM dependencies.
"""
import logging
from typing import List, Dict, Any, Optional, Tuple
from collections import Counter
import re

logger = logging.getLogger(__name__)


class NLPService:
    """Lightweight NLP processing using spaCy"""
    
    def __init__(self):
        self.nlp = None
        self._initialized = False
    
    def _lazy_init(self):
        """Lazy load spaCy model (13MB)"""
        if self._initialized:
            return
        
        try:
            import spacy
            try:
                self.nlp = spacy.load('en_core_web_sm')
                self._initialized = True
                logger.info("spaCy model loaded successfully")
            except OSError:
                logger.warning("spaCy model not found, run: python -m spacy download en_core_web_sm")
                self._initialized = False
        except ImportError:
            logger.warning("spaCy not installed, NLP features disabled")
            self._initialized = False
    
    def extract_entities(self, text: str, max_entities: int = 50) -> List[Dict[str, Any]]:
        """
        Extract named entities from text.
        
        Returns list of:
            {
                'type': str,        # PERSON, ORG, DATE, GPE, etc.
                'text': str,        # Entity text
                'confidence': float,# Confidence score
                'position': int     # Character position
            }
        """
        self._lazy_init()
        
        if not self._initialized or not text:
            return []
        
        try:
            doc = self.nlp(text[:100000])  # Limit to 100k chars for performance
            
            entities = []
            for ent in doc.ents[:max_entities]:
                entities.append({
                    'type': ent.label_,
                    'text': ent.text,
                    'confidence': 0.85,  # spaCy doesn't provide confidence, use default
                    'position': ent.start_char
                })
            
            return entities
        except Exception as e:
            logger.error(f"Entity extraction error: {str(e)}")
            return []
    
    def extract_keywords(self, text: str, top_k: int = 20) -> List[Dict[str, Any]]:
        """
        Extract keywords using TF-IDF approach.
        
        Returns list of:
            {
                'keyword': str,
                'score': float,
                'rank': int
            }
        """
        self._lazy_init()
        
        if not text:
            return []
        
        try:
            # Method 1: Use spaCy for lemmatization (if available)
            if self._initialized:
                doc = self.nlp(text[:50000])  # Limit for performance
                
                # Extract nouns and proper nouns
                keywords = []
                for token in doc:
                    if (token.pos_ in {'NOUN', 'PROPN'} and 
                        not token.is_stop and 
                        len(token.text) > 2):
                        keywords.append(token.lemma_.lower())
                
                # Count frequencies
                keyword_counts = Counter(keywords)
                
                # Convert to scored list
                total = sum(keyword_counts.values())
                results = []
                for rank, (keyword, count) in enumerate(keyword_counts.most_common(top_k), 1):
                    results.append({
                        'keyword': keyword,
                        'score': count / total if total > 0 else 0,
                        'rank': rank
                    })
                
                return results
            else:
                # Fallback: Simple frequency analysis
                return self._simple_keyword_extraction(text, top_k)
        
        except Exception as e:
            logger.error(f"Keyword extraction error: {str(e)}")
            return self._simple_keyword_extraction(text, top_k)
    
    def _simple_keyword_extraction(self, text: str, top_k: int) -> List[Dict[str, Any]]:
        """Fallback keyword extraction without NLP"""
        # Simple tokenization
        words = re.findall(r'\b[a-zA-Z]{3,}\b', text.lower())
        
        # Remove common stop words
        stop_words = {
            'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 
            'her', 'was', 'one', 'our', 'out', 'this', 'that', 'with', 'have',
            'from', 'they', 'been', 'will', 'would', 'there', 'their', 'what'
        }
        
        keywords = [w for w in words if w not in stop_words]
        
        # Count frequencies
        keyword_counts = Counter(keywords)
        
        # Convert to scored list
        total = sum(keyword_counts.values())
        results = []
        for rank, (keyword, count) in enumerate(keyword_counts.most_common(top_k), 1):
            results.append({
                'keyword': keyword,
                'score': count / total if total > 0 else 0,
                'rank': rank
            })
        
        return results
    
    def detect_language(self, text: str) -> Optional[str]:
        """
        Detect language of text.
        
        Returns ISO 639-1 language code (e.g., 'en', 'es', 'fr')
        """
        if not text or len(text) < 20:
            return None
        
        try:
            from langdetect import detect
            lang = detect(text[:5000])  # Use first 5000 chars
            return lang
        except ImportError:
            logger.warning("langdetect not installed, language detection disabled")
            return None
        except Exception as e:
            logger.error(f"Language detection error: {str(e)}")
            return None
    
    def get_text_stats(self, text: str) -> Dict[str, int]:
        """Get basic text statistics"""
        if not text:
            return {
                'word_count': 0,
                'char_count': 0,
                'sentence_count': 0,
                'paragraph_count': 0
            }
        
        # Word count
        words = re.findall(r'\b\w+\b', text)
        word_count = len(words)
        
        # Character count (excluding whitespace)
        char_count = len(text.replace(' ', '').replace('\n', '').replace('\t', ''))
        
        # Sentence count (approximate)
        sentences = re.split(r'[.!?]+', text)
        sentence_count = len([s for s in sentences if s.strip()])
        
        # Paragraph count
        paragraphs = text.split('\n\n')
        paragraph_count = len([p for p in paragraphs if p.strip()])
        
        return {
            'word_count': word_count,
            'char_count': char_count,
            'sentence_count': sentence_count,
            'paragraph_count': paragraph_count
        }
    
    def extract_dates(self, text: str) -> List[str]:
        """Extract date mentions from text"""
        self._lazy_init()
        
        if not self._initialized or not text:
            return []
        
        try:
            doc = self.nlp(text[:50000])
            dates = [ent.text for ent in doc.ents if ent.label_ == 'DATE']
            return list(set(dates))[:20]  # Return unique dates, max 20
        except Exception as e:
            logger.error(f"Date extraction error: {str(e)}")
            return []
    
    def extract_people(self, text: str) -> List[str]:
        """Extract person names from text"""
        self._lazy_init()
        
        if not self._initialized or not text:
            return []
        
        try:
            doc = self.nlp(text[:50000])
            people = [ent.text for ent in doc.ents if ent.label_ == 'PERSON']
            return list(set(people))[:20]  # Return unique names, max 20
        except Exception as e:
            logger.error(f"Person extraction error: {str(e)}")
            return []
    
    def extract_organizations(self, text: str) -> List[str]:
        """Extract organization names from text"""
        self._lazy_init()
        
        if not self._initialized or not text:
            return []
        
        try:
            doc = self.nlp(text[:50000])
            orgs = [ent.text for ent in doc.ents if ent.label_ == 'ORG']
            return list(set(orgs))[:20]  # Return unique orgs, max 20
        except Exception as e:
            logger.error(f"Organization extraction error: {str(e)}")
            return []


# Singleton instance
nlp_service = NLPService()
