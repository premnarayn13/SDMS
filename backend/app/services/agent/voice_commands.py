"""
Voice Command Parser
Converts natural language voice input to structured commands.
"""
import re
from typing import Optional, Dict, Any, List


class VoiceCommandParser:
    """Parses voice commands using pattern matching (no LLM needed)"""
    
    def __init__(self):
        # Command patterns with regex — ORDER MATTERS!
        # More specific patterns must come BEFORE broad catch-all patterns.
        # 'search' must be LAST since its patterns are very broad.
        self.command_patterns = {
            # Greetings (very specific, check first)
            'greet': [
                r'^hi(?:\s+docky)?[.!]?$',
                r'^hello(?:\s+docky)?[.!]?$',
                r'^hey(?:\s+docky)?[.!]?$',
                r'^good\s+(?:morning|afternoon|evening)',
                r'^(?:thanks|thank\s+you)'
            ],
            
            # Help (specific keywords)
            'help': [
                r'^help$',
                r'what\s+can\s+you\s+do',
                r'show\s+(?:me\s+)?(?:all\s+)?commands',
                r'^how\s+do\s+i'
            ],
            
            # Analytics & Storage (specific phrases, before search)
            'analytics': [
                r'(?:show|get|display)\s+(?:me\s+)?(?:the\s+)?analytics',
                r'(?:show|get|display)\s+(?:me\s+)?(?:the\s+)?statistics',
                r'(?:show|get|display)\s+(?:me\s+)?(?:the\s+)?stats',
                r'what\s+are\s+my\s+stats',
                r'how\s+many\s+files',
                r'analytics\s*dashboard'
            ],
            'storage': [
                r'how\s+much\s+storage',
                r'storage\s+(?:usage|info|status)',
                r'space\s+(?:used|left|remaining|available)',
                r'check\s+(?:my\s+)?storage',
                r'(?:show|get)\s+(?:me\s+)?storage'
            ],
            
            # Recent files (specific phrase, before search)
            'recent': [
                r'(?:show|get|list|display)\s+(?:me\s+)?(?:my\s+)?recent\s+files',
                r'recent(?:ly)?\s+(?:uploaded|added|modified)\s+files',
                r'what\s+(?:did\s+)?i\s+upload(?:ed)?\s+(?:recently|lately)',
                r'latest\s+files',
                r'^recent\s+files$',
                r'my\s+recent\s+files'
            ],
            
            # Duplicates (specific phrase, before search/find)
            'duplicates': [
                r'find\s+duplicate(?:s)?',
                r'(?:show|get|check)\s+(?:me\s+)?(?:for\s+)?duplicate(?:s)?\s*(?:files)?',
                r'duplicate\s+files'
            ],
            
            # File operations (specific verbs)
            'upload': [
                r'upload\s+(?:a\s+)?(?:new\s+)?file',
                r'add\s+(?:a\s+)?(?:new\s+)?file',
                r'create\s+(?:a\s+)?(?:new\s+)?document'
            ],
            'rename': [
                r'rename\s+(?:the\s+)?(?:file\s+)?["\']?(.+?)["\']?\s+(?:to|as|into)\s+["\']?(.+?)["\']?$',
                r'change\s+(?:the\s+)?name\s+of\s+(?:the\s+)?(?:file\s+)?["\']?(.+?)["\']?\s+(?:to|as|into)\s+["\']?(.+?)["\']?$',
                r'(?:re)?name\s+["\']?(.+?)["\']?\s+(?:to|as|into)\s+["\']?(.+?)["\']?$'
            ],
            'tag': [
                r'tag\s+(.+?)\s+(?:with|as)\s+(.+)',
                r'add\s+tag\s+(.+?)\s+to\s+(.+)',
                r'label\s+(.+?)\s+(?:with|as)\s+(.+)'
            ],
            'move': [
                r'move\s+(.+?)\s+to\s+(.+)',
                r'transfer\s+(.+?)\s+to\s+(.+)'
            ],
            'favorite': [
                r'(?:un)?fav(?:orite)?\s+(.+)',
                r'(?:un)?star\s+(.+)',
                r'(?:add|mark|set)\s+(.+?)\s+(?:as|to)\s+fav(?:orite)?',
                r'toggle\s+fav(?:orite)?\s+(?:for\s+)?(.+)'
            ],
            'open': [
                r'open\s+["\']?(.+?)["\']?$',
                r'view\s+["\']?(.+?)["\']?$',
                r'show\s+(?:me\s+)?(?:the\s+)?file\s+["\']?(.+?)["\']?$',
                r'launch\s+["\']?(.+?)["\']?$',
                r'read\s+["\']?(.+?)["\']?$',
                r'display\s+(?:the\s+)?(?:file\s+)?["\']?(.+?)["\']?$'
            ],
            'download': [
                r'download\s+(.+)',
                r'get\s+(?:me\s+)?(?:the\s+)?file\s+(.+)',
                r'save\s+(?:the\s+)?file\s+(.+)',
                r'export\s+(.+)'
            ],
            'delete': [
                r'delete\s+(.+)',
                r'remove\s+(.+)',
                r'trash\s+(.+)'
            ],
            'organize': [
                r'organize\s+(?:my\s+)?files',
                r'clean\s+up\s+(?:my\s+)?files',
                r'sort\s+(?:my\s+)?files'
            ],
            
            # Filter
            'filter': [
                r'filter\s+(?:by\s+)?(.+)',
                r'show\s+only\s+(.+)'
            ],
            
            # Search LAST — broad catch-all patterns
            'search': [
                r'search\s+(?:for\s+)?(.+)',
                r'find\s+(?:me\s+)?(.+)',
                r'look\s+for\s+(.+)',
                r'show\s+(?:me\s+)?(?:all\s+)?(.+)',
                r'where\s+is\s+(.+)'
            ]
        }
        
        # Compile patterns
        self.compiled_patterns = {}
        for cmd, patterns in self.command_patterns.items():
            self.compiled_patterns[cmd] = [
                re.compile(p, re.IGNORECASE) for p in patterns
            ]
    
    def parse(self, text: str) -> Dict[str, Any]:
        """
        Parse voice command text into structured command.
        
        Returns:
            {
                'command': str,         # Command type
                'action': str,          # Specific action
                'params': dict,         # Extracted parameters
                'confidence': float     # Match confidence
            }
        """
        text = text.strip()
        text_lower = text.lower()
        
        # Try to match each command pattern
        for cmd, patterns in self.compiled_patterns.items():
            for pattern in patterns:
                match = pattern.search(text)
                if match:
                    return self._build_command(cmd, match, text)
        
        # No match found - try semantic keywords
        return self._fallback_match(text_lower)
    
    def _build_command(self, cmd: str, match: re.Match, text: str) -> Dict[str, Any]:
        """Build command structure from regex match"""
        params = {}
        
        # Extract capture groups as parameters
        if match.groups():
            if cmd == 'rename':
                params['old_name'] = match.group(1).strip()
                params['new_name'] = match.group(2).strip()
            elif cmd == 'tag':
                params['file'] = match.group(1).strip()
                params['tag'] = match.group(2).strip()
            elif cmd == 'move':
                params['file'] = match.group(1).strip()
                params['destination'] = match.group(2).strip()
            elif cmd in ['search', 'download', 'delete', 'filter', 'open', 'favorite']:
                params['query'] = match.group(1).strip().strip('"\'')
        
        return {
            'command': cmd,
            'action': self._get_action(cmd),
            'params': params,
            'confidence': 0.95,
            'original_text': text
        }
    
    def _get_action(self, cmd: str) -> str:
        """Map command to action description"""
        action_map = {
            'upload': 'Open file upload dialog',
            'download': 'Download specified file',
            'open': 'Open specified file',
            'delete': 'Delete specified file',
            'rename': 'Rename file',
            'favorite': 'Toggle favorite',
            'search': 'Search for files',
            'filter': 'Apply filters',
            'analytics': 'Show analytics dashboard',
            'storage': 'Show storage usage',
            'tag': 'Add tags to file',
            'move': 'Move file to folder',
            'organize': 'Auto-organize files',
            'recent': 'Show recent files',
            'duplicates': 'Find duplicate files',
            'help': 'Show available commands',
            'greet': 'Greet user'
        }
        return action_map.get(cmd, 'Execute command')
    
    def _fallback_match(self, text: str) -> Dict[str, Any]:
        """Try to match using keyword frequencies"""
        keywords = {
            'upload': ['upload', 'add', 'new', 'create'],
            'search': ['find', 'search', 'look', 'where'],
            'open': ['open', 'view', 'launch', 'read', 'display'],
            'delete': ['delete', 'remove', 'trash', 'erase'],
            'favorite': ['favorite', 'fav', 'star', 'unstar', 'unfavorite'],
            'download': ['download', 'save', 'get'],
            'rename': ['rename', 'change name'],
            'analytics': ['stats', 'analytics', 'count', 'total'],
            'storage': ['storage', 'space', 'capacity', 'size'],
            'recent': ['recent', 'latest', 'new', 'last'],
            'help': ['help', 'how', 'what', 'guide']
        }
        
        scores = {}
        words = text.lower().split()
        
        for cmd, kw_list in keywords.items():
            score = sum(1 for kw in kw_list if kw in words)
            if score > 0:
                scores[cmd] = score
        
        if scores:
            best_cmd = max(scores, key=scores.get)
            return {
                'command': best_cmd,
                'action': self._get_action(best_cmd),
                'params': {'query': text},
                'confidence': 0.65,
                'original_text': text
            }
        
        # Complete fallback - treat as search
        return {
            'command': 'search',
            'action': 'Search for files',
            'params': {'query': text},
            'confidence': 0.40,
            'original_text': text
        }
    
    def get_suggestions(self, text: str) -> List[str]:
        """Get command suggestions based on partial input"""
        text = text.lower()
        suggestions = []
        
        suggestion_templates = {
            'upload': 'Upload a file',
            'search': f'Search for "{text}"',
            'delete': 'Delete a file',
            'recent': 'Show recent files',
            'analytics': 'Show analytics',
            'storage': 'Check storage usage',
            'duplicates': 'Find duplicate files',
            'organize': 'Organize my files',
            'help': 'Show all commands'
        }
        
        # Add suggestions that match the input
        for cmd, template in suggestion_templates.items():
            if cmd.startswith(text) or any(kw in text for kw in self.command_patterns.get(cmd, [])[0].split()):
                suggestions.append(template)
        
        return suggestions[:5]


# Singleton instance
voice_parser = VoiceCommandParser()
