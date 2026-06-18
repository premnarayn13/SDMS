"""
Tool Restrictions Configuration
Defines which tools are restricted from AI agent execution and require manual user action.
These operations are too sensitive or critical for autonomous execution.
"""

import logging
from typing import Dict, List, Set
from enum import Enum

logger = logging.getLogger(__name__)


class RestrictionLevel(Enum):
    """Restriction severity levels"""
    FORBIDDEN = "forbidden"  # Never execute by AI agent
    MANUAL_ONLY = "manual_only"  # Requires manual user action
    REQUIRES_CONFIRMATION = "requires_confirmation"  # Can execute but needs user confirmation


# Define restricted tools with their restriction levels and reasons
RESTRICTED_TOOLS: Dict[str, Dict[str, str]] = {
    # Signature and document authentication - NEVER autonomous
    "add_signature": {
        "level": RestrictionLevel.FORBIDDEN.value,
        "reason": "Adding signatures requires legal verification and user authentication. This must be done manually.",
        "action": "User must manually add signature to the document.",
    },
    "verify_signature": {
        "level": RestrictionLevel.FORBIDDEN.value,
        "reason": "Verifying signatures requires legal authority and cannot be automated.",
        "action": "User must manually verify the signature.",
    },
    "digital_sign": {
        "level": RestrictionLevel.FORBIDDEN.value,
        "reason": "Digital signing requires user key authentication and legal compliance.",
        "action": "User must manually digitally sign the document.",
    },
    
    # Form filling - Complex and requires user intent
    "fill_form": {
        "level": RestrictionLevel.FORBIDDEN.value,
        "reason": "Form filling with AI involves data accuracy risks and legal compliance. Manual verification needed.",
        "action": "User should manually review and fill critical form fields.",
    },
    "auto_fill_form": {
        "level": RestrictionLevel.MANUAL_ONLY.value,
        "reason": "Automatic form filling may introduce inaccuracies. Requires manual verification.",
        "action": "User should manually fill and verify form fields.",
    },
    
    # Document deletion - Irreversible action
    "permanently_delete": {
        "level": RestrictionLevel.MANUAL_ONLY.value,
        "reason": "Permanent deletion is irreversible. Requires explicit user confirmation.",
        "action": "User must manually confirm and perform permanent deletion.",
    },
    
    # Access control - Security sensitive
    "change_permissions": {
        "level": RestrictionLevel.MANUAL_ONLY.value,
        "reason": "Changing document permissions affects security and requires careful review.",
        "action": "User should manually change document permissions.",
    },
    "revoke_all_access": {
        "level": RestrictionLevel.MANUAL_ONLY.value,
        "reason": "Revoking all access is a critical security operation.",
        "action": "User must manually revoke access.",
    },
    
    # Financial and legal documents
    "sign_contract": {
        "level": RestrictionLevel.FORBIDDEN.value,
        "reason": "Contract signing requires legal authority and cannot be delegated to AI.",
        "action": "User must manually sign contracts.",
    },
    "process_payment": {
        "level": RestrictionLevel.FORBIDDEN.value,
        "reason": "Payment processing requires explicit user authorization and security.",
        "action": "User must manually process payments.",
    },
    
    # Page manipulation with security implications
    "rotate_page_modify_original": {
        "level": RestrictionLevel.MANUAL_ONLY.value,
        "reason": "Modifying original document structure should be done manually for critical documents.",
        "action": "User should manually rotate and review document pages.",
    },
    
    # Advanced cryptography
    "encrypt_with_key": {
        "level": RestrictionLevel.MANUAL_ONLY.value,
        "reason": "Encryption with custom keys requires user key management.",
        "action": "User should manually encrypt with their security keys.",
    },
    "decrypt_protected": {
        "level": RestrictionLevel.FORBIDDEN.value,
        "reason": "Decrypting protected documents requires explicit user authentication.",
        "action": "User must manually provide password/key and decrypt.",
    },
}

# Tools that are allowed for AI execution
ALLOWED_TOOLS: Set[str] = {
    # File management
    "search_files",
    "open_file",
    "download_file",
    "rename_file",
    "move_file",
    "duplicate_file",
    "delete_file",  # Soft delete to trash
    "restore_file",
    "toggle_favorite",
    "add_tag",
    "remove_tag",
    "share_file",
    "remove_share",
    "get_file_info",
    
    # Folder management
    "create_folder",
    "rename_folder",
    "move_folder",
    "delete_folder",
    "set_folder_color",
    "list_folders",
    "get_folder_tree",
    
    # Search and analysis
    "find_similar",
    "find_duplicates",
    "list_files",
    "list_recent_files",
    "filter_files",
    "get_analytics",
    "get_storage_info",
    "get_activity_log",
    "get_version_history",
    
    # Text extraction and analysis
    "extract_text",
    "extract_entities",
    "extract_keywords",
    "detect_language",
    "get_text_stats",
    
    # Preferences
    "update_preferences",
    "get_preferences",
    
    # Batch operations
    "batch_move",
    "batch_tag",
    "batch_delete",  # Soft delete
    
    # PDF Power Tools - ALLOWED (non-destructive by default)
    "extract_pdf_text",
    "convert_pdf_to_images",
    "merge_multiple_pdfs",
    "split_pdf_range",
    "split_pdf_pages",
    "compress_pdf",
    "rotate_pdf_pages",  # Creates new file
    "remove_pdf_pages",  # Creates new file
    "reorder_pdf_pages",  # Creates new file
    "duplicate_pdf_pages",  # Creates new file
    "add_pdf_watermark",  # Creates new file (non-destructive marking)
    # Word Power Tools
    "extract_docx_text",
    "convert_docx_to_pdf",
    "merge_word_documents",
    "replace_docx_text",
    "add_docx_watermark",
    # PPT Power Tools
    "extract_ppt_text",
    "split_ppt_slides",
    "merge_ppt_presentations",
    "add_ppt_watermark",
    # CSV Power Tools
    "extract_csv_preview",
    "get_csv_rows",
    "update_csv_cell",
    "append_csv_row",
    "delete_csv_row",
    "save_csv_file",
    # Media Power Tools
    "analyze_file",
    "extract_image_metadata",
    "extract_audio_metadata",
    "extract_video_metadata",
}

# Tools that require extra confirmation but are allowed
CONFIRMATION_REQUIRED_TOOLS: Set[str] = {
    "password_protect_pdf",  # Requires confirmation before protecting
    "delete_file",  # Even soft delete should be confirmed in multi-step operations
    "batch_delete",  # Batch operations need confirmation
}


class ToolRestrictionManager:
    """Manages tool execution restrictions and planning"""
    
    def __init__(self):
        self.restricted_tools = RESTRICTED_TOOLS
        self.allowed_tools = ALLOWED_TOOLS
        self.confirmation_required = CONFIRMATION_REQUIRED_TOOLS
        
    def is_tool_restricted(self, tool_name: str) -> bool:
        """Check if a tool is restricted from AI execution"""
        return tool_name in self.restricted_tools
    
    def is_tool_allowed(self, tool_name: str) -> bool:
        """Check if a tool is allowed for AI execution"""
        return tool_name in self.allowed_tools
    
    def requires_confirmation(self, tool_name: str) -> bool:
        """Check if a tool requires user confirmation before execution"""
        return tool_name in self.confirmation_required
    
    def get_restriction_reason(self, tool_name: str) -> str:
        """Get the reason why a tool is restricted"""
        if tool_name in self.restricted_tools:
            return self.restricted_tools[tool_name]["reason"]
        return "This operation is restricted."
    
    def get_restriction_action(self, tool_name: str) -> str:
        """Get the recommended manual action for a restricted tool"""
        if tool_name in self.restricted_tools:
            return self.restricted_tools[tool_name]["action"]
        return "Please perform this operation manually."
    
    def get_restriction_level(self, tool_name: str) -> str:
        """Get the restriction level"""
        if tool_name in self.restricted_tools:
            return self.restricted_tools[tool_name]["level"]
        return None
    
    def analyze_tool_calls(self, tool_calls: List[Dict]) -> Dict:
        """
        Analyze a list of tool calls and categorize them.
        
        Args:
            tool_calls: List of tool call dicts with 'name' or 'function.name'
            
        Returns:
            Dict with:
                - allowed_calls: List of allowed tool calls
                - restricted_calls: List of restricted tool calls with reasons
                - confirmation_calls: List of calls requiring confirmation
                - can_proceed: Boolean if any operations can be done
                - has_restrictions: Boolean if any operations are restricted
        """
        allowed = []
        restricted = []
        confirmation = []
        
        for call in tool_calls:
            # Handle both OpenAI format and simple format
            tool_name = call.get("function", {}).get("name") if isinstance(call.get("function"), dict) else call.get("name")
            if not tool_name:
                tool_name = call.get("function", "").split(".")[-1] if isinstance(call.get("function"), str) else None
            
            if not tool_name:
                continue
            
            if self.is_tool_restricted(tool_name):
                restricted.append({
                    "tool": tool_name,
                    "reason": self.get_restriction_reason(tool_name),
                    "action": self.get_restriction_action(tool_name),
                    "level": self.get_restriction_level(tool_name),
                    "original_call": call
                })
            elif self.requires_confirmation(tool_name):
                confirmation.append({
                    "tool": tool_name,
                    "call": call
                })
            elif self.is_tool_allowed(tool_name):
                allowed.append(call)
        
        return {
            "allowed_calls": allowed,
            "restricted_calls": restricted,
            "confirmation_calls": confirmation,
            "can_proceed": len(allowed) > 0 or len(confirmation) > 0,
            "has_restrictions": len(restricted) > 0,
        }


def get_restriction_manager() -> ToolRestrictionManager:
    """Get singleton instance of restriction manager"""
    if not hasattr(get_restriction_manager, "_instance"):
        get_restriction_manager._instance = ToolRestrictionManager()
    return get_restriction_manager._instance
