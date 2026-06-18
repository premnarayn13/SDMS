"""
Tool Definitions for Docky Autonomous Agent
Defines all 35+ tools that the LLM can call to perform actions
"""
from typing import Dict, List, Any


def get_tool_definitions() -> List[Dict[str, Any]]:
    """
    Get all tool definitions in OpenAI function calling format.
    These tools map to actual service functions in tool_registry.py
    
    Returns:
        List of tool definition dicts

        # ===== MEDIA POWER TOOLS =====
        {
            "type": "function",
            "function": {
                "name": "analyze_file",
                "description": "Analyze any file type and return safe, basic metadata plus suggested agent operations.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "file_id": {
                            "type": "string",
                            "description": "ID of the file"
                        }
                    },
                    "required": ["file_id"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "extract_image_metadata",
                "description": "Get basic image metadata such as width, height, format, and EXIF presence.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "file_id": {
                            "type": "string",
                            "description": "ID of the image file"
                        }
                    },
                    "required": ["file_id"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "extract_audio_metadata",
                "description": "Get basic audio metadata such as duration, channels, and sample rate when available.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "file_id": {
                            "type": "string",
                            "description": "ID of the audio file"
                        }
                    },
                    "required": ["file_id"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "extract_video_metadata",
                "description": "Get basic video metadata such as duration, frame count, width, height, and fps when available.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "file_id": {
                            "type": "string",
                            "description": "ID of the video file"
                        }
                    },
                    "required": ["file_id"]
                }
            }
        }
    """
    return [
        # ===== FILE OPERATIONS =====
        {
            "type": "function",
            "function": {
                "name": "search_files",
                "description": "Search for files by name, content, or tags. Use this to find files before performing operations on them.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "Search query (filename, content, or tag)"
                        },
                        "search_type": {
                            "type": "string",
                            "enum": ["all", "filename", "content", "tags"],
                            "description": "Type of search to perform",
                            "default": "all"
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Maximum number of results",
                            "default": 10
                        }
                    },
                    "required": ["query"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "open_file",
                "description": "Open a file in the viewer. Returns the file's view URL.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "file_id": {
                            "type": "string",
                            "description": "ID of the file to open"
                        }
                    },
                    "required": ["file_id"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "download_file",
                "description": "Download a file to the user's computer.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "file_id": {
                            "type": "string",
                            "description": "ID of the file to download"
                        }
                    },
                    "required": ["file_id"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "rename_file",
                "description": "Rename a file to a new name.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "file_id": {
                            "type": "string",
                            "description": "ID of the file to rename"
                        },
                        "new_name": {
                            "type": "string",
                            "description": "New filename (without extension if keeping same extension)"
                        }
                    },
                    "required": ["file_id", "new_name"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "move_file",
                "description": "Move a file to a different folder.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "file_id": {
                            "type": "string",
                            "description": "ID of the file to move"
                        },
                        "folder_name": {
                            "type": ["string", "null"],
                            "description": "Name of the destination folder (or 'root' / 'My Drive' for root)"
                        },
                        "folder_id": {
                            "type": ["string", "null"],
                            "description": "Optional destination folder ID"
                        },
                        "destination_folder": {
                            "type": ["string", "null"],
                            "description": "Optional alias for destination folder name"
                        }
                    },
                    "required": ["file_id"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "duplicate_file",
                "description": "Create a copy of a file.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "file_id": {
                            "type": "string",
                            "description": "ID of the file to duplicate"
                        }
                    },
                    "required": ["file_id"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "delete_file",
                "description": "Move a file to trash (soft delete). Does NOT permanently delete.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "file_id": {
                            "type": "string",
                            "description": "ID of the file to delete"
                        }
                    },
                    "required": ["file_id"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "restore_file",
                "description": "Restore a file from trash.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "file_id": {
                            "type": "string",
                            "description": "ID of the file to restore"
                        }
                    },
                    "required": ["file_id"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "toggle_favorite",
                "description": "Add or remove a star/favorite marking on a file.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "file_id": {
                            "type": "string",
                            "description": "ID of the file"
                        }
                    },
                    "required": ["file_id"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "add_tag",
                "description": "Add a tag to a file for organization.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "file_id": {
                            "type": "string",
                            "description": "ID of the file"
                        },
                        "tag": {
                            "type": "string",
                            "description": "Tag to add (e.g., 'important', 'review', 'draft')"
                        }
                    },
                    "required": ["file_id", "tag"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "remove_tag",
                "description": "Remove a tag from a file.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "file_id": {
                            "type": "string",
                            "description": "ID of the file"
                        },
                        "tag": {
                            "type": "string",
                            "description": "Tag to remove"
                        }
                    },
                    "required": ["file_id", "tag"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "share_file",
                "description": "Share a file with another user via email.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "file_id": {
                            "type": "string",
                            "description": "ID of the file to share"
                        },
                        "email": {
                            "type": "string",
                            "description": "Email address to share with"
                        },
                        "permission": {
                            "type": "string",
                            "enum": ["viewer", "editor", "admin"],
                            "description": "Permission level",
                            "default": "viewer"
                        }
                    },
                    "required": ["file_id", "email"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "remove_share",
                "description": "Remove a user's access to a shared file.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "file_id": {
                            "type": "string",
                            "description": "ID of the file"
                        },
                        "email": {
                            "type": "string",
                            "description": "Email address to revoke access from"
                        }
                    },
                    "required": ["file_id", "email"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "get_file_info",
                "description": "Get detailed information about a file (size, type, dates, etc.).",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "file_id": {
                            "type": "string",
                            "description": "ID of the file"
                        }
                    },
                    "required": ["file_id"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "run_power_tool",
                "description": "Run file-format power tool operations such as conversion, page management, and extraction.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "file_id": {
                            "type": "string",
                            "description": "File id or exact filename to run power tools on"
                        },
                        "file_ids": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Optional list of file ids for multi-file operations (merge)"
                        },
                        "operation": {
                            "type": "string",
                            "enum": [
                                "convert",
                                "add_pages",
                                "delete_pages",
                                "insert_pages",
                                "duplicate_pages",
                                "extract_pages",
                                "split_pages",
                                "split_ranges",
                                "reorder_pages",
                                "rotate_pages",
                                "compress_pdf",
                                "merge_pdfs",
                                "extract_tables",
                                "extract_fonts"
                            ],
                            "description": "Power tool operation type"
                        },
                        "target_format": {
                            "type": "string",
                            "description": "Desired output format such as pdf, doc, txt, ppt, jpg, png"
                        },
                        "insert_file_id": {
                            "type": "string",
                            "description": "Source PDF id for insert_pages"
                        },
                        "page_numbers": {
                            "type": ["array", "string"],
                            "description": "Pages to target (1-based). Accepts array or comma/range string."
                        },
                        "ranges": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "start": {"type": "integer"},
                                    "end": {"type": "integer"}
                                }
                            },
                            "description": "Page ranges for split_ranges"
                        },
                        "copies": {
                            "type": "integer",
                            "description": "Number of duplicates per page"
                        },
                        "rotation_degrees": {
                            "type": "integer",
                            "description": "Rotation degrees for rotate_pages"
                        },
                        "output_name": {
                            "type": "string",
                            "description": "Optional output filename for merge or export"
                        },
                        "save_to_storage": {
                            "type": "boolean",
                            "description": "Whether converted output should be saved in app storage",
                            "default": True
                        },
                        "export": {
                            "type": "boolean",
                            "description": "Whether converted output should also be exported/downloaded",
                            "default": True
                        }
                    },
                    "required": ["operation"]
                }
            }
        },
        
        # ===== FOLDER OPERATIONS =====
        {
            "type": "function",
            "function": {
                "name": "create_folder",
                "description": "Create a new folder.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "folder_name": {
                            "type": "string",
                            "description": "Name of the folder to create"
                        },
                        "parent_folder": {
                            "type": ["string", "null"],
                            "description": "Name of parent folder (optional, for subfolders)"
                        },
                        "color": {
                            "type": ["string", "null"],
                            "description": "Optional folder color"
                        }
                    },
                    "required": ["folder_name"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "rename_folder",
                "description": "Rename an existing folder.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "folder_name": {
                            "type": "string",
                            "description": "Current folder name"
                        },
                        "folder_id": {
                            "type": "string",
                            "description": "Optional folder id (preferred when available)"
                        },
                        "new_name": {
                            "type": "string",
                            "description": "New folder name"
                        }
                    },
                    "required": ["new_name"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "move_folder",
                "description": "Move a folder to a different parent folder.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "folder_name": {
                            "type": "string",
                            "description": "Name of folder to move"
                        },
                        "folder_id": {
                            "type": "string",
                            "description": "Optional folder id to move"
                        },
                        "parent_folder": {
                            "type": ["string", "null"],
                            "description": "Name of new parent folder (or 'root' for My Drive root)"
                        },
                        "target_parent_id": {
                            "type": ["string", "null"],
                            "description": "Optional target parent folder id"
                        },
                        "destination_folder": {
                            "type": ["string", "null"],
                            "description": "Optional alias for target parent folder name"
                        }
                    },
                    "required": []
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "delete_folder",
                "description": "Delete a folder (uses recursive mode by default for autonomous workflows).",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "folder_name": {
                            "type": "string",
                            "description": "Folder name to delete"
                        },
                        "folder_id": {
                            "type": "string",
                            "description": "Optional folder ID to delete"
                        },
                        "recursive": {
                            "type": "boolean",
                            "description": "Delete nested children too",
                            "default": True
                        }
                    },
                    "required": []
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "set_folder_color",
                "description": "Change the color of a folder.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "folder_name": {
                            "type": "string",
                            "description": "Name of the folder"
                        },
                        "color": {
                            "type": "string",
                            "description": "Color name or hex code"
                        }
                    },
                    "required": ["folder_name", "color"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "list_folders",
                "description": "List all folders or folders in a specific location.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "parent_folder": {
                            "type": ["string", "null"],
                            "description": "Optional parent folder to list subfolders of"
                        }
                    }
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "get_folder_tree",
                "description": "Get the complete folder tree structure.",
                "parameters": {
                    "type": "object",
                    "properties": {}
                }
            }
        },
        
        # ===== SEARCH & DISCOVERY =====
        {
            "type": "function",
            "function": {
                "name": "find_similar",
                "description": "Find files similar to a given file based on content.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "file_id": {
                            "type": "string",
                            "description": "ID of the reference file"
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Maximum number of results",
                            "default": 10
                        }
                    },
                    "required": ["file_id"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "find_duplicates",
                "description": "Find duplicate files based on content hash and name similarity.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "include_similar": {
                            "type": "boolean",
                            "description": "Also include near-duplicates with similar names",
                            "default": True
                        }
                    }
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "list_recent_files",
                "description": "Get recently accessed or uploaded files.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "days": {
                            "type": "integer",
                            "description": "Number of days to look back",
                            "default": 7
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Maximum number of files",
                            "default": 10
                        }
                    }
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "list_files",
                "description": "List files by view (all, recent, favorites, shared, trash) or inside a folder.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "view": {
                            "type": "string",
                            "enum": ["all", "recent", "favorites", "shared", "trash", "folder"],
                            "description": "Which file view to list",
                            "default": "all"
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Maximum number of files",
                            "default": 50
                        },
                        "folder_name": {
                            "type": ["string", "null"],
                            "description": "Folder name to list files from"
                        },
                        "folder_id": {
                            "type": ["string", "null"],
                            "description": "Folder id to list files from"
                        }
                    }
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "filter_files",
                "description": "Filter files by type, tag, date range, or size.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "file_type": {
                            "type": "string",
                            "description": "File type/extension (e.g., 'pdf', 'docx', 'image')"
                        },
                        "tag": {
                            "type": "string",
                            "description": "Filter by tag"
                        },
                        "min_size_mb": {
                            "type": "number",
                            "description": "Minimum file size in MB"
                        },
                        "max_size_mb": {
                            "type": "number",
                            "description": "Maximum file size in MB"
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Maximum results",
                            "default": 20
                        }
                    }
                }
            }
        },
        
        # ===== ANALYTICS & INFO =====
        {
            "type": "function",
            "function": {
                "name": "get_analytics",
                "description": "Get analytics dashboard with file statistics, activity stats, and breakdowns.",
                "parameters": {
                    "type": "object",
                    "properties": {}
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "get_storage_info",
                "description": "Get storage usage information across all drives.",
                "parameters": {
                    "type": "object",
                    "properties": {}
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "get_activity_log",
                "description": "Get user activity history.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "days": {
                            "type": "integer",
                            "description": "Number of days to retrieve",
                            "default": 7
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Maximum number of activities",
                            "default": 50
                        }
                    }
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "get_version_history",
                "description": "Get version history for a file.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "file_id": {
                            "type": "string",
                            "description": "ID of the file"
                        }
                    },
                    "required": ["file_id"]
                }
            }
        },
        
        # ===== NLP OPERATIONS =====
        {
            "type": "function",
            "function": {
                "name": "extract_text",
                "description": "Extract text content from a document (PDF, DOCX, etc.).",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "file_id": {
                            "type": "string",
                            "description": "ID of the file"
                        }
                    },
                    "required": ["file_id"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "extract_entities",
                "description": "Extract named entities (people, organizations, dates, locations) from a document.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "file_id": {
                            "type": "string",
                            "description": "ID of the file"
                        }
                    },
                    "required": ["file_id"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "extract_keywords",
                "description": "Extract important keywords from a document using TF-IDF.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "file_id": {
                            "type": "string",
                            "description": "ID of the file"
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Maximum number of keywords",
                            "default": 10
                        }
                    },
                    "required": ["file_id"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "detect_language",
                "description": "Detect the language of a document (supports 55+ languages).",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "file_id": {
                            "type": "string",
                            "description": "ID of the file"
                        }
                    },
                    "required": ["file_id"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "get_text_stats",
                "description": "Get text statistics (word count, character count, sentences, paragraphs).",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "file_id": {
                            "type": "string",
                            "description": "ID of the file"
                        }
                    },
                    "required": ["file_id"]
                }
            }
        },
        
        # ===== USER PREFERENCES =====
        {
            "type": "function",
            "function": {
                "name": "update_preferences",
                "description": "Update user preferences (theme, view mode, sort order, etc.).",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "theme": {
                            "type": "string",
                            "enum": ["light", "dark"],
                            "description": "UI theme"
                        },
                        "view_mode": {
                            "type": "string",
                            "enum": ["grid", "list", "detail"],
                            "description": "File view mode"
                        },
                        "sort_by": {
                            "type": "string",
                            "enum": ["name", "date", "size", "type"],
                            "description": "Sort criterion"
                        },
                        "sort_order": {
                            "type": "string",
                            "enum": ["asc", "desc"],
                            "description": "Sort direction"
                        }
                    }
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "get_preferences",
                "description": "Get current user preferences.",
                "parameters": {
                    "type": "object",
                    "properties": {}
                }
            }
        },
        
        # ===== BATCH OPERATIONS =====
        {
            "type": "function",
            "function": {
                "name": "batch_move",
                "description": "Move multiple files to a folder at once.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "file_ids": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "List of file IDs to move"
                        },
                        "folder_name": {
                            "type": "string",
                            "description": "Destination folder name"
                        }
                    },
                    "required": ["file_ids", "folder_name"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "batch_tag",
                "description": "Add a tag to multiple files at once.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "file_ids": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "List of file IDs"
                        },
                        "tag": {
                            "type": "string",
                            "description": "Tag to add"
                        }
                    },
                    "required": ["file_ids", "tag"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "batch_delete",
                "description": "Move multiple files to trash at once.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "file_ids": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "List of file IDs to delete"
                        }
                    },
                    "required": ["file_ids"]
                }
            }
        },
        
        # ===== PDF POWER TOOLS (ADVANCED) =====
        {
            "type": "function",
            "function": {
                "name": "extract_pdf_text",
                "description": "Extract all text content from a PDF file.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "file_id": {
                            "type": "string",
                            "description": "ID of the PDF file"
                        }
                    },
                    "required": ["file_id"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "convert_pdf_to_images",
                "description": "Convert PDF pages to individual image files (PNG).",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "file_id": {
                            "type": "string",
                            "description": "ID of the PDF file"
                        },
                        "save_to_storage": {
                            "type": "boolean",
                            "description": "Save converted images to storage",
                            "default": True
                        }
                    },
                    "required": ["file_id"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "merge_multiple_pdfs",
                "description": "Merge multiple PDF files into a single document.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "file_ids": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "List of PDF file IDs to merge"
                        },
                        "output_name": {
                            "type": "string",
                            "description": "Name for the merged output file"
                        },
                        "save_to_storage": {
                            "type": "boolean",
                            "description": "Save merged PDF to storage",
                            "default": True
                        }
                    },
                    "required": ["file_ids"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "split_pdf_range",
                "description": "Extract a specific page range from a PDF.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "file_id": {
                            "type": "string",
                            "description": "ID of the PDF file"
                        },
                        "start_page": {
                            "type": "integer",
                            "description": "Starting page number (1-based)"
                        },
                        "end_page": {
                            "type": "integer",
                            "description": "Ending page number (inclusive, 1-based)"
                        },
                        "output_name": {
                            "type": "string",
                            "description": "Optional output filename"
                        },
                        "save_to_storage": {
                            "type": "boolean",
                            "description": "Save extracted PDF to storage",
                            "default": True
                        }
                    },
                    "required": ["file_id", "start_page", "end_page"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "split_pdf_pages",
                "description": "Split a PDF into individual page files.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "file_id": {
                            "type": "string",
                            "description": "ID of the PDF file"
                        },
                        "save_to_storage": {
                            "type": "boolean",
                            "description": "Save split pages to storage",
                            "default": True
                        }
                    },
                    "required": ["file_id"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "compress_pdf",
                "description": "Reduce the file size of a PDF by compressing content streams.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "file_id": {
                            "type": "string",
                            "description": "ID of the PDF file"
                        },
                        "save_to_storage": {
                            "type": "boolean",
                            "description": "Save compressed PDF to storage",
                            "default": True
                        }
                    },
                    "required": ["file_id"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "rotate_pdf_pages",
                "description": "Rotate specific pages in a PDF (90, 180, or 270 degrees).",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "file_id": {
                            "type": "string",
                            "description": "ID of the PDF file"
                        },
                        "page_numbers": {
                            "type": "array",
                            "items": {"type": "integer"},
                            "description": "Page numbers to rotate (1-based)"
                        },
                        "rotation_degrees": {
                            "type": "integer",
                            "enum": [90, 180, 270],
                            "description": "Rotation degrees"
                        },
                        "save_to_storage": {
                            "type": "boolean",
                            "description": "Save rotated PDF to storage",
                            "default": True
                        }
                    },
                    "required": ["file_id", "page_numbers", "rotation_degrees"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "remove_pdf_pages",
                "description": "Remove specific pages from a PDF.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "file_id": {
                            "type": "string",
                            "description": "ID of the PDF file"
                        },
                        "page_numbers": {
                            "type": "array",
                            "items": {"type": "integer"},
                            "description": "Page numbers to remove (1-based)"
                        },
                        "save_to_storage": {
                            "type": "boolean",
                            "description": "Save modified PDF to storage",
                            "default": True
                        }
                    },
                    "required": ["file_id", "page_numbers"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "reorder_pdf_pages",
                "description": "Reorder pages in a PDF by providing a new page sequence.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "file_id": {
                            "type": "string",
                            "description": "ID of the PDF file"
                        },
                        "page_order": {
                            "type": "array",
                            "items": {"type": "integer"},
                            "description": "New page order (e.g., [3,1,2] for 3 pages)"
                        },
                        "save_to_storage": {
                            "type": "boolean",
                            "description": "Save reordered PDF to storage",
                            "default": True
                        }
                    },
                    "required": ["file_id", "page_order"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "duplicate_pdf_pages",
                "description": "Duplicate specific pages in a PDF.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "file_id": {
                            "type": "string",
                            "description": "ID of the PDF file"
                        },
                        "page_numbers": {
                            "type": "array",
                            "items": {"type": "integer"},
                            "description": "Page numbers to duplicate (1-based)"
                        },
                        "copies": {
                            "type": "integer",
                            "description": "Number of duplicates per page",
                            "default": 1
                        },
                        "save_to_storage": {
                            "type": "boolean",
                            "description": "Save modified PDF to storage",
                            "default": True
                        }
                    },
                    "required": ["file_id", "page_numbers"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "password_protect_pdf",
                "description": "Add password protection to a PDF file.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "file_id": {
                            "type": "string",
                            "description": "ID of the PDF file"
                        },
                        "password": {
                            "type": "string",
                            "description": "Password to set"
                        },
                        "save_to_storage": {
                            "type": "boolean",
                            "description": "Save protected PDF to storage",
                            "default": True
                        }
                    },
                    "required": ["file_id", "password"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "add_pdf_watermark",
                "description": "Add a text watermark to all pages of a PDF.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "file_id": {
                            "type": "string",
                            "description": "ID of the PDF file"
                        },
                        "watermark_text": {
                            "type": "string",
                            "description": "Text to use as watermark"
                        },
                        "opacity": {
                            "type": "number",
                            "description": "Watermark opacity (0.0-1.0)",
                            "default": 0.3
                        },
                        "save_to_storage": {
                            "type": "boolean",
                            "description": "Save watermarked PDF to storage",
                            "default": True
                        }
                    },
                    "required": ["file_id", "watermark_text"]
                }
            }
        }
    ]
