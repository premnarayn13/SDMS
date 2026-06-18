"""
Safety Guard for Docky Agent
Blocks dangerous operations that require OTP verification or user confirmation
"""
import logging
from typing import Dict, Any, Optional, Tuple

logger = logging.getLogger(__name__)


class SafetyGuard:
    """
    Guards against dangerous operations that should not be automated.
    Classifies operations into safety levels and blocks RED operations.
    """
    
    # Operations that are blocked (require OTP or UI interaction)
    BLOCKED_OPERATIONS = {
        "permanent_delete_file",
        "delete_folder",  # Requires OTP
        "delete_account",
        "change_password",
        "unlink_drive",
        "manage_sessions"
    }
    
    # Operations that require confirmation (>N items affected)
    BATCH_THRESHOLDS = {
        "batch_delete": 5,  # Confirm if deleting >5 files
        "batch_move": 10,   # Confirm if moving >10 files
        "share_file": 1,    # Always confirm sharing
    }
    
    def __init__(self):
        """Initialize safety guard"""
        logger.info("Safety Guard initialized")
    
    def check_operation(self, tool_name: str, args: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """
        Check if an operation is safe to execute.
        
        Args:
            tool_name: Name of the tool/operation
            args: Tool arguments
            
        Returns:
            Tuple of (is_safe, reason_if_blocked)
        """
        # Check if operation is explicitly blocked
        if tool_name in self.BLOCKED_OPERATIONS:
            reason = self._get_blocked_reason(tool_name)
            logger.warning(f"Blocked operation: {tool_name} - {reason}")
            return False, reason
        
        # Check for implicit dangerous operations
        if "delete" in tool_name.lower():
            # Check if it's a permanent delete request
            if args.get("permanent") is True or args.get("force") is True:
                reason = ("Permanent deletion requires OTP verification. "
                         "Please use the Settings panel to permanently delete items.")
                logger.warning(f"Blocked permanent delete: {tool_name}")
                return False, reason
        
        # Check batch operation thresholds
        if tool_name in self.BATCH_THRESHOLDS:
            threshold = self.BATCH_THRESHOLDS[tool_name]
            
            # Count affected items
            item_count = 0
            if "file_ids" in args:
                item_count = len(args["file_ids"])
            elif "folder_ids" in args:
                item_count = len(args["folder_ids"])
            
            if item_count > threshold:
                reason = (f"This batch operation affects {item_count} items. "
                         f"For safety, operations affecting >{threshold} items "
                         f"should be confirmed in the UI.")
                logger.info(f"Batch threshold exceeded: {tool_name} ({item_count} items)")
                return False, reason
        
        # Operation is safe
        return True, None
    
    def _get_blocked_reason(self, tool_name: str) -> str:
        """
        Get explanation for why an operation is blocked.
        
        Args:
            tool_name: Name of the blocked operation
            
        Returns:
            Human-readable reason
        """
        reasons = {
            "permanent_delete_file": (
                "Permanent file deletion requires OTP verification for your security. "
                "Please use the Settings panel to permanently delete files."
            ),
            "delete_folder": (
                "Folder deletion requires OTP verification to protect your folder structure. "
                "Please use the Settings panel to delete folders."
            ),
            "delete_account": (
                "Account deletion requires email verification for your protection. "
                "Please use the Settings panel to delete your account."
            ),
            "change_password": (
                "Password changes cannot be automated for security reasons. "
                "Please use the Settings panel to change your password."
            ),
            "unlink_drive": (
                "Unlinking Google Drive requires explicit confirmation in Settings. "
                "This ensures you don't accidentally lose access to your files."
            ),
            "manage_sessions": (
                "Session management should be done manually for security. "
                "Please use the Settings panel to manage your active sessions."
            )
        }
        
        return reasons.get(tool_name, 
                          "This operation requires manual confirmation for security.")
    
    def get_safety_level(self, tool_name: str) -> str:
        """
        Get safety level classification for a tool.
        
        Args:
            tool_name: Tool name
            
        Returns:
            "green" (safe), "yellow" (needs confirmation), or "red" (blocked)
        """
        if tool_name in self.BLOCKED_OPERATIONS:
            return "red"
        
        if tool_name in self.BATCH_THRESHOLDS:
            return "yellow"
        
        if "delete" in tool_name.lower() or "remove" in tool_name.lower():
            return "yellow"
        
        return "green"
    
    def format_safety_message(self, tool_name: str, blocked_reason: str) -> str:
        """
        Format a user-friendly safety message.
        
        Args:
            tool_name: Name of the tool
            blocked_reason: Reason it was blocked
            
        Returns:
            Formatted message for the user
        """
        return f"🔒 **Safety Guard**: {blocked_reason}"


# Global safety guard instance
_safety_guard: SafetyGuard = None


def get_safety_guard() -> SafetyGuard:
    """Get or create global safety guard"""
    global _safety_guard
    if _safety_guard is None:
        _safety_guard = SafetyGuard()
    return _safety_guard
