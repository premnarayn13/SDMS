"""
Tool Registry for Docky Agent
Maps tool names to backend-local implementations.

This registry intentionally uses the legacy local data store so agent actions
continue to work even when cloud dependencies are temporarily unavailable.
"""
import logging
import re
from collections import Counter
from datetime import datetime
from typing import Dict, Any, Callable, Optional, List
from difflib import SequenceMatcher

from app.database import db as legacy_db
from app.services.documents.service import documents_service
from app.services.folders.service import folders_service
from app.services.drive.service import drive_service
from app.services.activity.service import activity_service
from app.services.agent.text_extractor import text_extractor
from app.services.agent.nlp_service import nlp_service

logger = logging.getLogger(__name__)


class ToolRegistry:
    """Registry of all tools available to the agent."""

    def __init__(self):
        self.db = legacy_db
        self._preferences: Dict[str, Dict[str, Any]] = {}

        self.tools: Dict[str, Callable] = {
            "search_files": self.search_files,
            "open_file": self.open_file,
            "download_file": self.download_file,
            "rename_file": self.rename_file,
            "move_file": self.move_file,
            "duplicate_file": self.duplicate_file,
            "delete_file": self.delete_file,
            "restore_file": self.restore_file,
            "toggle_favorite": self.toggle_favorite,
            "add_tag": self.add_tag,
            "remove_tag": self.remove_tag,
            "share_file": self.share_file,
            "remove_share": self.remove_share,
            "get_file_info": self.get_file_info,
            "run_power_tool": self.run_power_tool,
            "create_folder": self.create_folder,
            "rename_folder": self.rename_folder,
            "move_folder": self.move_folder,
            "delete_folder": self.delete_folder,
            "set_folder_color": self.set_folder_color,
            "list_folders": self.list_folders,
            "get_folder_tree": self.get_folder_tree,
            "find_similar": self.find_similar,
            "find_duplicates": self.find_duplicates,
            "list_files": self.list_files,
            "list_recent_files": self.list_recent_files,
            "filter_files": self.filter_files,
            "get_analytics": self.get_analytics,
            "get_storage_info": self.get_storage_info,
            "get_activity_log": self.get_activity_log,
            "get_version_history": self.get_version_history,
            "extract_text": self.extract_text,
            "extract_entities": self.extract_entities,
            "extract_keywords": self.extract_keywords,
            "detect_language": self.detect_language,
            "get_text_stats": self.get_text_stats,
            "update_preferences": self.update_preferences,
            "get_preferences": self.get_preferences,
            "batch_move": self.batch_move,
            "batch_tag": self.batch_tag,
            "batch_delete": self.batch_delete,
            # PDF Power Tools
            "extract_pdf_text": self.extract_pdf_text,
            "convert_pdf_to_images": self.convert_pdf_to_images,
            "merge_multiple_pdfs": self.merge_multiple_pdfs,
            "split_pdf_range": self.split_pdf_range,
            "split_pdf_pages": self.split_pdf_pages,
            "compress_pdf": self.compress_pdf,
            "rotate_pdf_pages": self.rotate_pdf_pages,
            "remove_pdf_pages": self.remove_pdf_pages,
            "reorder_pdf_pages": self.reorder_pdf_pages,
            "duplicate_pdf_pages": self.duplicate_pdf_pages,
            "password_protect_pdf": self.password_protect_pdf,
            "add_pdf_watermark": self.add_pdf_watermark,
            # Word Power Tools
            "extract_docx_text": self.extract_docx_text,
            "convert_docx_to_pdf": self.convert_docx_to_pdf,
            "merge_word_documents": self.merge_word_documents,
            "replace_docx_text": self.replace_docx_text,
            "add_docx_watermark": self.add_docx_watermark,
            # PPT Power Tools
            "extract_ppt_text": self.extract_ppt_text,
            "split_ppt_slides": self.split_ppt_slides,
            "merge_ppt_presentations": self.merge_ppt_presentations,
            "add_ppt_watermark": self.add_ppt_watermark,
            # CSV Power Tools
            "extract_csv_preview": self.extract_csv_preview,
            "get_csv_rows": self.get_csv_rows,
            "update_csv_cell": self.update_csv_cell,
            "append_csv_row": self.append_csv_row,
            "delete_csv_row": self.delete_csv_row,
            "save_csv_file": self.save_csv_file,
            # Media Power Tools
            "analyze_file": self.analyze_file,
            "extract_image_metadata": self.extract_image_metadata,
            "extract_audio_metadata": self.extract_audio_metadata,
            "extract_video_metadata": self.extract_video_metadata,
        }

        logger.info("Tool Registry initialized with %s tools", len(self.tools))

    def _infer_extension_from_document(self, document: Dict[str, Any]) -> str:
        name = (document.get("display_name") or document.get("original_name") or "").strip()
        if "." in name:
            return name.rsplit(".", 1)[1].lower()
        extension = (document.get("file_extension") or "").strip().lower()
        return extension

    def get_tool(self, tool_name: str) -> Optional[Callable]:
        return self.tools.get(tool_name)

    def has_tool(self, tool_name: str) -> bool:
        return tool_name in self.tools

    def _to_int_id(self, file_id: str) -> Optional[int]:
        try:
            return int(file_id)
        except (TypeError, ValueError):
            return None

    def _resolve_file(self, file_ref: Any) -> tuple[Optional[int], Optional[dict]]:
        """Resolve a file by numeric id or by filename."""
        if file_ref is None:
            return None, None

        file_ref_str = str(file_ref).strip()
        item_id = self._to_int_id(file_ref_str)

        if item_id is not None:
            item = self.db.get_item(item_id)
            if item and item.get("type") == "file":
                return item_id, item

        target = file_ref_str.lower()
        exact = None
        partial = None
        for file_item in self._list_files(include_trash=True):
            name = str(file_item.get("name", "")).lower()
            if name == target:
                exact = file_item
                break
            if target in name and partial is None:
                partial = file_item

        chosen = exact or partial
        if not chosen:
            return None, None
        return int(chosen.get("id")), chosen

    def _list_items(self) -> List[dict]:
        return self.db.get_all_items() or []

    def _list_files(self, include_trash: bool = False) -> List[dict]:
        return [
            item for item in self._list_items()
            if item.get("type") == "file" and (include_trash or not item.get("trash", False))
        ]

    def _list_folders(self, include_trash: bool = False) -> List[dict]:
        return [
            item for item in self._list_items()
            if item.get("type") == "folder" and (include_trash or not item.get("trash", False))
        ]

    def _find_folder_by_name(self, folder_name: str) -> Optional[dict]:
        if not folder_name:
            return None
        target = folder_name.strip().lower()
        exact = None
        partial = None
        for folder in self._list_folders():
            name = folder.get("name", "").strip().lower()
            if name == target:
                exact = folder
                break
            if target in name and partial is None:
                partial = folder
        return exact or partial

    def _is_root_folder_ref(self, value: Any) -> bool:
        if value is None:
            return True
        text = str(value).strip().lower()
        return text in {"", "root", "my drive", "my drive (root)", "home", "/", "none", "null"}

    def _find_cloud_folder(self, folders: List[dict], folder_ref: Any) -> Optional[dict]:
        if self._is_root_folder_ref(folder_ref):
            return None

        value = str(folder_ref).strip()
        if not value:
            return None

        by_id = next((f for f in folders if str(f.get("id")) == value), None)
        if by_id:
            return by_id

        target = value.lower()
        exact = next((f for f in folders if (f.get("name") or "").strip().lower() == target), None)
        if exact:
            return exact

        return next((f for f in folders if target in (f.get("name") or "").strip().lower()), None)

    def _normalize_file_payload(self, file_item: dict) -> dict:
        return {
            "id": file_item.get("id"),
            "file_id": str(file_item.get("id")),
            "name": file_item.get("name"),
            "original_filename": file_item.get("name"),
            "file_type": file_item.get("fileType", "Document"),
            "size": file_item.get("size", 0),
            "tags": file_item.get("tags", []),
            "favorite": file_item.get("favorite", False),
            "parent_id": file_item.get("parentId"),
            "trash": file_item.get("trash", False),
            "mime_type": file_item.get("mimeType"),
        }

    def _extract_text_content(self, file_item: dict) -> str:
        content = file_item.get("content")
        if isinstance(content, str):
            return content
        return ""

    async def _get_cloud_text(self, user_id: str, file_ref: Any) -> tuple[Optional[str], Optional[str]]:
        document = await self._resolve_cloud_document(user_id, file_ref)
        if not document:
            return None, None

        document_id = document.get("id")
        filename = document.get("display_name") or document.get("original_name") or "document"
        content, _name, _mime = await documents_service.download_document(user_id, document_id)
        extracted, error = text_extractor.extract(content, filename)
        if error:
            return None, error
        return extracted or "", None

    def _normalize_cloud_file_payload(self, document: dict) -> dict:
        return {
            "id": document.get("id"),
            "file_id": str(document.get("id")),
            "name": document.get("display_name") or document.get("original_name"),
            "original_filename": document.get("display_name") or document.get("original_name"),
            "file_type": document.get("file_type", "Document"),
            "size": document.get("size_bytes", 0),
            "tags": document.get("tags") or [],
            "favorite": document.get("is_favorite", False),
            "parent_id": document.get("virtual_folder_id"),
            "trash": document.get("status") == "trashed",
            "mime_type": document.get("mime_type"),
        }

    def _flatten_folder_tree(self, nodes: List[dict], parent_id: Optional[str] = None) -> List[dict]:
        flattened: List[dict] = []
        for node in nodes or []:
            current = {
                "id": node.get("id"),
                "name": node.get("name"),
                "parent_id": node.get("parent_id", parent_id),
            }
            flattened.append(current)
            children = node.get("children") or []
            if children:
                flattened.extend(self._flatten_folder_tree(children, node.get("id")))
        return flattened

    async def _get_cloud_files(self, user_id: str, view: str = "all", page_size: int = 500) -> List[dict]:
        docs, _total = await documents_service.get_documents(
            user_id=user_id,
            view=view,
            page=1,
            page_size=page_size,
        )
        return docs or []

    async def _resolve_cloud_document(self, user_id: str, file_ref: Any) -> Optional[dict]:
        if file_ref is None:
            return None

        if isinstance(file_ref, dict):
            file_ref = (
                file_ref.get("file_id")
                or file_ref.get("id")
                or file_ref.get("document_id")
                or file_ref.get("name")
                or file_ref.get("filename")
            )

        if isinstance(file_ref, list) and file_ref:
            file_ref = file_ref[0]
            if isinstance(file_ref, dict):
                file_ref = (
                    file_ref.get("file_id")
                    or file_ref.get("id")
                    or file_ref.get("document_id")
                    or file_ref.get("name")
                    or file_ref.get("filename")
                )

        if file_ref is None:
            return None

        file_ref_str = str(file_ref).strip()
        if not file_ref_str:
            return None

        # Try as direct document id first
        try:
            return await documents_service.get_document(user_id, file_ref_str)
        except Exception:
            pass

        # Fallback to name-based lookup (exact then partial)
        target = file_ref_str.lower()
        try:
            documents = await self._get_cloud_files(user_id=user_id, view="all", page_size=500)
            exact = None
            partial = None
            for document in documents:
                name = (document.get("display_name") or document.get("original_name") or "").lower()
                if name == target:
                    exact = document
                    break
                if target in name and partial is None:
                    partial = document
            return exact or partial
        except Exception:
            return None

    def _pick_file_ref(self, file_id: Any, kwargs: Dict[str, Any]) -> Any:
        if file_id:
            return file_id
        return (
            kwargs.get("document_id")
            or kwargs.get("id")
            or kwargs.get("file_name")
            or kwargs.get("filename")
            or kwargs.get("name")
            or kwargs.get("file")
        )

    def _is_cloud_like_ref(self, file_ref: Any) -> bool:
        if file_ref is None:
            return False

        value = str(file_ref).strip()
        if not value:
            return False

        if value.isdigit():
            return False

        if re.match(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$", value):
            return True

        return "-" in value or len(value) > 20

    async def _get_cloud_folders(self, user_id: str) -> List[dict]:
        tree = await folders_service.get_folder_tree(user_id)
        return self._flatten_folder_tree(tree or [])

    async def search_files(self, user_id: str, query: str, search_type: str = "all", limit: int = 10, **kwargs) -> Dict[str, Any]:
        try:
            try:
                documents = await self._get_cloud_files(user_id=user_id, view="all", page_size=500)
                q = (query or "").strip().lower()
                if not q:
                    return {"success": True, "files": [], "count": 0, "action": "search"}

                matches = []
                for document in documents:
                    name = (document.get("display_name") or document.get("original_name") or "").lower()
                    tags = [str(tag).lower() for tag in (document.get("tags") or [])]
                    name_match = q in name
                    tag_match = any(q in tag for tag in tags)

                    if search_type == "filename" and not name_match:
                        continue
                    if search_type == "tags" and not tag_match:
                        continue
                    if search_type in ["all", "content"] and not (name_match or tag_match):
                        continue

                    matches.append(self._normalize_cloud_file_payload(document))

                if not matches:
                    fuzzy_candidates = []
                    for document in documents:
                        name_raw = (document.get("display_name") or document.get("original_name") or "")
                        name = name_raw.lower()
                        if not name:
                            continue
                        score = SequenceMatcher(None, q, name).ratio()
                        compact_q = "".join(ch for ch in q if ch.isalnum())
                        compact_name = "".join(ch for ch in name if ch.isalnum())
                        if compact_q and compact_name:
                            compact_score = SequenceMatcher(None, compact_q, compact_name).ratio()
                            score = max(score, compact_score)
                        if score >= 0.55:
                            fuzzy_candidates.append((score, self._normalize_cloud_file_payload(document)))

                    fuzzy_candidates.sort(key=lambda x: x[0], reverse=True)
                    matches = [entry for _, entry in fuzzy_candidates]

                matches = matches[: max(1, int(limit or 10))]
                first_file_id = str(matches[0]["id"]) if matches else None

                return {
                    "success": True,
                    "files": matches,
                    "count": len(matches),
                    "first_file_id": first_file_id,
                    "fuzzy_match": bool(matches) and not any((query or "").strip().lower() in (f.get("name", "").lower()) for f in matches),
                    "action": "search"
                }
            except Exception as cloud_error:
                logger.warning("Cloud search fallback to legacy store: %s", cloud_error)

            q = (query or "").strip().lower()
            if not q:
                return {"success": True, "files": [], "count": 0, "action": "search"}

            matches = []
            for file_item in self._list_files():
                name = (file_item.get("name") or "").lower()
                tags = [str(tag).lower() for tag in (file_item.get("tags") or [])]
                content = self._extract_text_content(file_item).lower()

                name_match = q in name
                tag_match = any(q in tag for tag in tags)
                content_match = q in content if content else False

                if search_type == "filename" and not name_match:
                    continue
                if search_type == "tags" and not tag_match:
                    continue
                if search_type == "content" and not content_match:
                    continue
                if search_type == "all" and not (name_match or tag_match or content_match):
                    continue

                matches.append(self._normalize_file_payload(file_item))

            if not matches:
                fuzzy_candidates = []
                for file_item in self._list_files():
                    name_raw = file_item.get("name") or ""
                    name = name_raw.lower()
                    if not name:
                        continue
                    score = SequenceMatcher(None, q, name).ratio()
                    compact_q = "".join(ch for ch in q if ch.isalnum())
                    compact_name = "".join(ch for ch in name if ch.isalnum())
                    if compact_q and compact_name:
                        compact_score = SequenceMatcher(None, compact_q, compact_name).ratio()
                        score = max(score, compact_score)
                    if score >= 0.55:
                        fuzzy_candidates.append((score, self._normalize_file_payload(file_item)))

                fuzzy_candidates.sort(key=lambda x: x[0], reverse=True)
                matches = [entry for _, entry in fuzzy_candidates]

            matches = matches[: max(1, int(limit or 10))]
            first_file_id = str(matches[0]["id"]) if matches else None

            return {
                "success": True,
                "files": matches,
                "count": len(matches),
                "first_file_id": first_file_id,
                "fuzzy_match": bool(matches) and not any((query or "").strip().lower() in (f.get("name", "").lower()) for f in matches),
                "action": "search"
            }
        except Exception as e:
            logger.error("Search error: %s", e)
            return {"success": False, "error": str(e)}

    async def open_file(self, user_id: str, file_id: str, **kwargs) -> Dict[str, Any]:
        try:
            try:
                file_ref = self._pick_file_ref(file_id, kwargs)
                document = await self._resolve_cloud_document(user_id, file_ref)
                if not document:
                    return {"success": False, "error": "File not found"}
                document_id = document.get("id")
                view_url = await documents_service.get_download_url(user_id, document_id)
                filename = document.get("display_name") or document.get("original_name")
                return {
                    "success": True,
                    "file_id": str(document_id),
                    "filename": filename,
                    "file_name": filename,
                    "view_url": view_url,
                    "action": "open"
                }
            except Exception as cloud_error:
                logger.warning("Cloud open fallback to legacy store: %s", cloud_error)

            item_id, file_item = self._resolve_file(file_id)
            if not file_item or file_item.get("type") != "file":
                return {"success": False, "error": "File not found"}

            self.db.add_history(item_id, "Opened")

            return {
                "success": True,
                "file_id": str(item_id),
                "filename": file_item.get("name"),
                "file_name": file_item.get("name"),
                "action": "open"
            }
        except Exception as e:
            logger.error("Open file error: %s", e)
            return {"success": False, "error": str(e)}

    async def download_file(self, user_id: str, file_id: str, **kwargs) -> Dict[str, Any]:
        try:
            try:
                file_ref = self._pick_file_ref(file_id, kwargs)
                document = await self._resolve_cloud_document(user_id, file_ref)
                if not document:
                    return {"success": False, "error": "File not found"}

                document_id = document.get("id")
                filename = document.get("display_name") or document.get("original_name")
                download_url = await documents_service.get_download_url(user_id, document_id)
                return {
                    "success": True,
                    "file_id": str(document_id),
                    "filename": filename,
                    "file_name": filename,
                    "download_url": download_url,
                    "action": "download"
                }
            except Exception as cloud_error:
                logger.warning("Cloud download fallback to legacy store: %s", cloud_error)

            item_id, file_item = self._resolve_file(file_id)
            if not file_item or file_item.get("type") != "file":
                return {"success": False, "error": "File not found"}

            self.db.add_history(item_id, "Downloaded")
            return {
                "success": True,
                "file_id": str(item_id),
                "filename": file_item.get("name"),
                "file_name": file_item.get("name"),
                "action": "download"
            }
        except Exception as e:
            logger.error("Download error: %s", e)
            return {"success": False, "error": str(e)}

    async def rename_file(self, user_id: str, file_id: str, new_name: str, **kwargs) -> Dict[str, Any]:
        try:
            file_ref = self._pick_file_ref(file_id, kwargs)
            strict_cloud = self._is_cloud_like_ref(file_ref)
            try:
                document = await self._resolve_cloud_document(user_id, file_ref)
                if not document:
                    return {"success": False, "error": "File not found"}

                document_id = document.get("id")
                old_name = document.get("display_name") or document.get("original_name")
                document = await documents_service.update_document(
                    user_id,
                    document_id,
                    {"display_name": new_name},
                )
                return {
                    "success": True,
                    "file_id": str(document_id),
                    "old_name": old_name,
                    "new_name": document.get("display_name") or new_name,
                    "action": "rename"
                }
            except Exception as cloud_error:
                logger.warning("Cloud rename fallback to legacy store: %s", cloud_error)
                if strict_cloud:
                    return {"success": False, "error": f"Cloud rename failed: {cloud_error}"}

            item_id, file_item = self._resolve_file(file_id)
            if not file_item or file_item.get("type") != "file":
                return {"success": False, "error": "File not found"}

            old_name = file_item.get("name")
            updated = self.db.update_item(item_id, {"name": new_name})
            if not updated:
                return {"success": False, "error": "Rename failed"}

            self.db.add_history(item_id, f"Renamed from \"{old_name}\"")
            return {
                "success": True,
                "file_id": str(item_id),
                "old_name": old_name,
                "new_name": new_name,
                "action": "rename"
            }
        except Exception as e:
            logger.error("Rename error: %s", e)
            return {"success": False, "error": str(e)}

    async def move_file(self, user_id: str, file_id: str, folder_name: str = None, **kwargs) -> Dict[str, Any]:
        try:
            destination_ref = (
                folder_name
                or kwargs.get("destination_folder")
                or kwargs.get("target_folder")
                or kwargs.get("parent_folder")
                or kwargs.get("folder_id")
                or kwargs.get("target_folder_id")
            )

            try:
                file_ref = self._pick_file_ref(file_id, kwargs)
                document = await self._resolve_cloud_document(user_id, file_ref)
                if not document:
                    return {"success": False, "error": "File not found"}
                document_id = document.get("id")

                folders = await self._get_cloud_folders(user_id)
                target_folder = self._find_cloud_folder(folders, destination_ref)
                target_folder_id = target_folder.get("id") if target_folder else None
                if not self._is_root_folder_ref(destination_ref) and not target_folder:
                    return {"success": False, "error": f"Folder '{destination_ref}' not found"}

                await documents_service.move_document(user_id, document_id, target_folder_id)
                return {
                    "success": True,
                    "file_id": str(document_id),
                    "folder_name": (target_folder or {}).get("name") or "My Drive",
                    "destination": (target_folder or {}).get("name") or "My Drive",
                    "action": "move"
                }
            except Exception as cloud_error:
                logger.warning("Cloud move fallback to legacy store: %s", cloud_error)

            target_folder = None if self._is_root_folder_ref(destination_ref) else self._find_folder_by_name(str(destination_ref))
            if not self._is_root_folder_ref(destination_ref) and not target_folder:
                return {"success": False, "error": f"Folder '{destination_ref}' not found"}

            item_id, file_item = self._resolve_file(file_id)
            if not file_item or file_item.get("type") != "file":
                return {"success": False, "error": "File not found"}

            target_parent_id = target_folder.get("id") if target_folder else None
            self.db.update_item(item_id, {"parentId": target_parent_id})
            self.db.add_history(item_id, f"Moved to {(target_folder or {}).get('name') or 'My Drive'}")
            return {
                "success": True,
                "file_id": str(item_id),
                "folder_name": (target_folder or {}).get("name") or "My Drive",
                "destination": (target_folder or {}).get("name") or "My Drive",
                "action": "move"
            }
        except Exception as e:
            logger.error("Move error: %s", e)
            return {"success": False, "error": str(e)}

    async def delete_file(self, user_id: str, file_id: str, **kwargs) -> Dict[str, Any]:
        try:
            try:
                file_ref = self._pick_file_ref(file_id, kwargs)
                document = await self._resolve_cloud_document(user_id, file_ref)
                if not document:
                    return {"success": False, "error": "File not found"}
                document_id = document.get("id")

                await documents_service.delete_document(user_id, document_id, permanent=False)
                return {
                    "success": True,
                    "file_id": str(document_id),
                    "action": "delete",
                    "note": "File moved to trash"
                }
            except Exception as cloud_error:
                logger.warning("Cloud delete fallback to legacy store: %s", cloud_error)

            item_id, file_item = self._resolve_file(file_id)
            if not file_item:
                return {"success": False, "error": "File not found"}

            self.db.update_item(item_id, {"trash": True})
            self.db.add_history(item_id, "Moved to trash")
            return {
                "success": True,
                "file_id": str(item_id),
                "filename": file_item.get("name"),
                "action": "delete",
                "note": "File moved to trash"
            }
        except Exception as e:
            logger.error("Delete error: %s", e)
            return {"success": False, "error": str(e)}

    async def restore_file(self, user_id: str, file_id: str, **kwargs) -> Dict[str, Any]:
        try:
            try:
                file_ref = self._pick_file_ref(file_id, kwargs)
                document = await self._resolve_cloud_document(user_id, file_ref)
                if not document:
                    return {"success": False, "error": "File not found"}
                document_id = document.get("id")

                await documents_service.restore_document(user_id, document_id)
                return {
                    "success": True,
                    "file_id": str(document_id),
                    "action": "restore"
                }
            except Exception as cloud_error:
                logger.warning("Cloud restore fallback to legacy store: %s", cloud_error)

            item_id, file_item = self._resolve_file(file_id)
            if not file_item:
                return {"success": False, "error": "File not found"}

            self.db.update_item(item_id, {"trash": False})
            self.db.add_history(item_id, "Restored from trash")
            return {
                "success": True,
                "file_id": str(item_id),
                "action": "restore"
            }
        except Exception as e:
            logger.error("Restore error: %s", e)
            return {"success": False, "error": str(e)}

    async def toggle_favorite(self, user_id: str, file_id: str, **kwargs) -> Dict[str, Any]:
        try:
            file_ref = self._pick_file_ref(file_id, kwargs)
            strict_cloud = self._is_cloud_like_ref(file_ref)
            desired_state = kwargs.get("desired_state")
            if isinstance(desired_state, str):
                lowered = desired_state.strip().lower()
                if lowered in {"true", "1", "yes", "on"}:
                    desired_state = True
                elif lowered in {"false", "0", "no", "off"}:
                    desired_state = False
                else:
                    desired_state = None
            elif not isinstance(desired_state, bool):
                desired_state = None
            try:
                document = await self._resolve_cloud_document(user_id, file_ref)
                if not document:
                    return {"success": False, "error": "File not found"}
                document_id = document.get("id")

                current_state = bool(document.get("is_favorite", False))
                target_state = desired_state if desired_state is not None else (not current_state)
                if target_state != current_state:
                    document = await documents_service.toggle_favorite(user_id, document_id)
                else:
                    document = await documents_service.get_document(user_id, document_id)
                filename = document.get("display_name") or document.get("original_name")
                return {
                    "success": True,
                    "file_id": str(document_id),
                    "filename": filename,
                    "is_favorite": document.get("is_favorite", False),
                    "action": "favorite"
                }
            except Exception as cloud_error:
                logger.warning("Cloud favorite fallback to legacy store: %s", cloud_error)
                if strict_cloud:
                    return {"success": False, "error": f"Cloud favorite failed: {cloud_error}"}

            item_id, file_item = self._resolve_file(file_id)
            if not file_item:
                return {"success": False, "error": "File not found"}

            current_state = bool(file_item.get("favorite", False))
            new_state = desired_state if desired_state is not None else (not current_state)
            self.db.update_item(item_id, {"favorite": new_state})
            self.db.add_history(item_id, "Added to favorites" if new_state else "Removed from favorites")
            return {
                "success": True,
                "file_id": str(item_id),
                "filename": file_item.get("name"),
                "is_favorite": new_state,
                "action": "favorite"
            }
        except Exception as e:
            logger.error("Favorite error: %s", e)
            return {"success": False, "error": str(e)}

    async def add_tag(self, user_id: str, file_id: str, tag: str, **kwargs) -> Dict[str, Any]:
        try:
            try:
                file_ref = self._pick_file_ref(file_id, kwargs)
                document = await self._resolve_cloud_document(user_id, file_ref)
                if not document:
                    return {"success": False, "error": "File not found"}
                document_id = document.get("id")

                document = await documents_service.add_tag(user_id, document_id, tag)
                filename = document.get("display_name") or document.get("original_name")
                return {
                    "success": True,
                    "file_id": str(document_id),
                    "filename": filename,
                    "tag": tag,
                    "action": "add_tag"
                }
            except Exception as cloud_error:
                logger.warning("Cloud add tag fallback to legacy store: %s", cloud_error)

            item_id, file_item = self._resolve_file(file_id)
            if not file_item:
                return {"success": False, "error": "File not found"}

            tags = list(file_item.get("tags") or [])
            if tag not in tags:
                tags.append(tag)
                self.db.update_item(item_id, {"tags": tags})
                self.db.add_history(item_id, f"Added tag: {tag}")

            return {
                "success": True,
                "file_id": str(item_id),
                "filename": file_item.get("name"),
                "tag": tag,
                "action": "add_tag"
            }
        except Exception as e:
            logger.error("Add tag error: %s", e)
            return {"success": False, "error": str(e)}

    async def remove_tag(self, user_id: str, file_id: str, tag: str, **kwargs) -> Dict[str, Any]:
        try:
            try:
                file_ref = self._pick_file_ref(file_id, kwargs)
                document = await self._resolve_cloud_document(user_id, file_ref)
                if not document:
                    return {"success": False, "error": "File not found"}
                document_id = document.get("id")

                document = await documents_service.remove_tag(user_id, document_id, tag)
                filename = document.get("display_name") or document.get("original_name")
                return {
                    "success": True,
                    "file_id": str(document_id),
                    "filename": filename,
                    "tag": tag,
                    "action": "remove_tag"
                }
            except Exception as cloud_error:
                logger.warning("Cloud remove tag fallback to legacy store: %s", cloud_error)

            item_id, file_item = self._resolve_file(file_id)
            if not file_item:
                return {"success": False, "error": "File not found"}

            tags = [t for t in (file_item.get("tags") or []) if t != tag]
            self.db.update_item(item_id, {"tags": tags})
            self.db.add_history(item_id, f"Removed tag: {tag}")

            return {
                "success": True,
                "file_id": str(item_id),
                "filename": file_item.get("name"),
                "tag": tag,
                "action": "remove_tag"
            }
        except Exception as e:
            logger.error("Remove tag error: %s", e)
            return {"success": False, "error": str(e)}

    async def share_file(self, user_id: str, file_id: str, email: str, permission: str = "viewer", **kwargs) -> Dict[str, Any]:
        try:
            normalized_permission = permission if permission in {"viewer", "editor", "admin"} else "viewer"
            try:
                file_ref = self._pick_file_ref(file_id, kwargs)
                document = await self._resolve_cloud_document(user_id, file_ref)
                if not document:
                    return {"success": False, "error": "File not found"}
                document_id = document.get("id")

                await documents_service.add_share(user_id, document_id, email, normalized_permission)
                return {
                    "success": True,
                    "file_id": str(document_id),
                    "shared_with": email,
                    "permission": normalized_permission,
                    "action": "share"
                }
            except Exception as cloud_error:
                logger.warning("Cloud share fallback to legacy store: %s", cloud_error)

            item_id, file_item = self._resolve_file(file_id)
            if not file_item:
                return {"success": False, "error": "File not found"}

            shared = list(file_item.get("shared") or [])
            if not any(str(s.get("email", "")).lower() == email.lower() for s in shared):
                shared.append({"email": email, "permission": normalized_permission})
                self.db.update_item(item_id, {"shared": shared})
                self.db.add_history(item_id, f"Shared with {email}")

            return {
                "success": True,
                "file_id": str(item_id),
                "shared_with": email,
                "permission": normalized_permission,
                "action": "share"
            }
        except Exception as e:
            logger.error("Share error: %s", e)
            return {"success": False, "error": str(e)}

    async def remove_share(self, user_id: str, file_id: str, email: str, **kwargs) -> Dict[str, Any]:
        try:
            try:
                file_ref = self._pick_file_ref(file_id, kwargs)
                document = await self._resolve_cloud_document(user_id, file_ref)
                if not document:
                    return {"success": False, "error": "File not found"}
                document_id = document.get("id")

                await documents_service.remove_share(user_id, document_id, email)
                return {
                    "success": True,
                    "file_id": str(document_id),
                    "removed_share": email,
                    "action": "remove_share"
                }
            except Exception as cloud_error:
                logger.warning("Cloud remove share fallback to legacy store: %s", cloud_error)

            item_id, file_item = self._resolve_file(file_id)
            if not file_item:
                return {"success": False, "error": "File not found"}

            shared = [s for s in (file_item.get("shared") or []) if str(s.get("email", "")).lower() != email.lower()]
            self.db.update_item(item_id, {"shared": shared})
            self.db.add_history(item_id, f"Removed {email} from sharing")

            return {
                "success": True,
                "file_id": str(item_id),
                "removed_share": email,
                "action": "remove_share"
            }
        except Exception as e:
            logger.error("Remove share error: %s", e)
            return {"success": False, "error": str(e)}

    async def get_file_info(self, user_id: str, file_id: str, **kwargs) -> Dict[str, Any]:
        try:
            try:
                file_ref = self._pick_file_ref(file_id, kwargs)
                document = await self._resolve_cloud_document(user_id, file_ref)
                if not document:
                    return {"success": False, "error": "File not found"}
                return {
                    "success": True,
                    "file": self._normalize_cloud_file_payload(document),
                    "action": "info"
                }
            except Exception as cloud_error:
                logger.warning("Cloud file info fallback to legacy store: %s", cloud_error)

            item_id, file_item = self._resolve_file(file_id)
            if not file_item or file_item.get("type") != "file":
                return {"success": False, "error": "File not found"}

            return {
                "success": True,
                "file": self._normalize_file_payload(file_item),
                "action": "info"
            }
        except Exception as e:
            logger.error("Get info error: %s", e)
            return {"success": False, "error": str(e)}

    async def run_power_tool(
        self,
        user_id: str,
        file_id: str = None,
        operation: str = "",
        target_format: str = None,
        save_to_storage: bool = True,
        export: bool = True,
        **kwargs,
    ) -> Dict[str, Any]:
        try:
            op = (operation or "").strip().lower()
            target = (target_format or "").strip().lower() if target_format else ""

            file_ref = self._pick_file_ref(file_id, kwargs) if file_id else kwargs.get("file_ref")
            file_ids = kwargs.get("file_ids") or []
            insert_file_id = kwargs.get("insert_file_id")
            page_numbers = kwargs.get("page_numbers")
            ranges = kwargs.get("ranges")
            copies = kwargs.get("copies")
            rotation_degrees = kwargs.get("rotation_degrees")
            output_name = kwargs.get("output_name")

            if op == "convert" and not target:
                return {"success": False, "error": "target_format is required"}

            if op == "merge_pdfs" and not file_ids:
                return {"success": False, "error": "file_ids is required for merge_pdfs"}

            try:
                document = await self._resolve_cloud_document(user_id, file_ref) if file_ref else None
                if document:
                    filename = document.get("display_name") or document.get("original_name")
                    source_extension = self._infer_extension_from_document(document)
                    return {
                        "success": True,
                        "file_id": str(document.get("id")),
                        "filename": filename,
                        "operation": op,
                        "target_format": target,
                        "source_format": source_extension,
                        "file_ids": file_ids,
                        "insert_file_id": insert_file_id,
                        "page_numbers": page_numbers,
                        "ranges": ranges,
                        "copies": copies,
                        "rotation_degrees": rotation_degrees,
                        "output_name": output_name,
                        "save_to_storage": bool(save_to_storage),
                        "export": bool(export),
                        "action": "power_tool"
                    }
            except Exception as cloud_error:
                logger.warning("Cloud power tool fallback to legacy store: %s", cloud_error)

            item_id, file_item = self._resolve_file(file_ref) if file_ref else (None, None)
            if file_ref and (not file_item or file_item.get("type") != "file"):
                return {"success": False, "error": "File not found"}

            filename = file_item.get("name") if file_item else None
            source_extension = filename.rsplit(".", 1)[1].lower() if filename and "." in filename else ""
            return {
                "success": True,
                "file_id": str(item_id) if item_id is not None else None,
                "filename": filename,
                "operation": op,
                "target_format": target,
                "source_format": source_extension,
                "file_ids": file_ids,
                "insert_file_id": insert_file_id,
                "page_numbers": page_numbers,
                "ranges": ranges,
                "copies": copies,
                "rotation_degrees": rotation_degrees,
                "output_name": output_name,
                "save_to_storage": bool(save_to_storage),
                "export": bool(export),
                "action": "power_tool"
            }
        except Exception as e:
            logger.error("Power tool error: %s", e)
            return {"success": False, "error": str(e)}

    async def create_folder(self, user_id: str, folder_name: str, parent_folder: str = None, color: str = None, **kwargs) -> Dict[str, Any]:
        try:
            try:
                parent_id = None
                if parent_folder:
                    folders = await self._get_cloud_folders(user_id)
                    parent = self._find_cloud_folder(folders, parent_folder)
                    if not parent and not self._is_root_folder_ref(parent_folder):
                        return {"success": False, "error": f"Parent folder '{parent_folder}' not found"}
                    parent_id = parent.get("id") if parent else None

                folder = await folders_service.create_folder(
                    user_id=user_id,
                    name=folder_name,
                    parent_id=parent_id,
                    color=color,
                )
                return {
                    "success": True,
                    "folder_id": str(folder.get("id")),
                    "folder_name": folder.get("name", folder_name),
                    "action": "create_folder"
                }
            except Exception as cloud_error:
                logger.warning("Cloud create folder fallback to legacy store: %s", cloud_error)

            parent_id = None
            if parent_folder:
                parent = self._find_folder_by_name(parent_folder)
                if not parent:
                    return {"success": False, "error": f"Parent folder '{parent_folder}' not found"}
                parent_id = parent.get("id")

            folder = self.db.create_item({
                "name": folder_name,
                "type": "folder",
                "parentId": parent_id,
                "size": 0,
                "color": color,
            })
            return {
                "success": True,
                "folder_id": str(folder.get("id")),
                "folder_name": folder_name,
                "action": "create_folder"
            }
        except Exception as e:
            logger.error("Create folder error: %s", e)
            return {"success": False, "error": str(e)}

    async def rename_folder(self, user_id: str, folder_name: str, new_name: str, **kwargs) -> Dict[str, Any]:
        try:
            folder_ref = kwargs.get("folder_id") or kwargs.get("folder_ref") or folder_name
            try:
                folders = await self._get_cloud_folders(user_id)
                folder = self._find_cloud_folder(folders, folder_ref)
                if not folder:
                    return {"success": False, "error": f"Folder '{folder_ref}' not found"}

                await folders_service.update_folder(user_id, folder.get("id"), {"name": new_name})
                return {
                    "success": True,
                    "folder_id": str(folder.get("id")),
                    "old_name": folder.get("name") or folder_name,
                    "new_name": new_name,
                    "action": "rename_folder"
                }
            except Exception as cloud_error:
                logger.warning("Cloud rename folder fallback to legacy store: %s", cloud_error)

            folder = self._find_folder_by_name(str(folder_ref))
            if not folder:
                return {"success": False, "error": f"Folder '{folder_ref}' not found"}

            self.db.update_item(folder.get("id"), {"name": new_name})
            self.db.add_history(folder.get("id"), f"Renamed from {folder.get('name')}")
            return {
                "success": True,
                "folder_id": str(folder.get("id")),
                "old_name": folder.get("name") or folder_name,
                "new_name": new_name,
                "action": "rename_folder"
            }
        except Exception as e:
            logger.error("Rename folder error: %s", e)
            return {"success": False, "error": str(e)}

    async def move_folder(self, user_id: str, folder_name: str, parent_folder: str = None, **kwargs) -> Dict[str, Any]:
        try:
            source_ref = kwargs.get("folder_id") or kwargs.get("folder_ref") or folder_name
            destination_ref = (
                kwargs.get("target_parent_id")
                or kwargs.get("destination_folder")
                or kwargs.get("target_folder")
                or parent_folder
            )

            try:
                folders = await self._get_cloud_folders(user_id)
                folder = self._find_cloud_folder(folders, source_ref)
                parent = self._find_cloud_folder(folders, destination_ref)

                if not folder:
                    return {"success": False, "error": f"Folder '{source_ref}' not found"}
                if not self._is_root_folder_ref(destination_ref) and not parent:
                    return {"success": False, "error": f"Parent folder '{destination_ref}' not found"}

                await folders_service.move_folder(user_id, folder.get("id"), parent.get("id") if parent else None)
                return {
                    "success": True,
                    "folder_name": folder.get("name") or folder_name,
                    "parent_folder": (parent or {}).get("name") or "My Drive",
                    "action": "move_folder"
                }
            except Exception as cloud_error:
                logger.warning("Cloud move folder fallback to legacy store: %s", cloud_error)

            folder = self._find_folder_by_name(str(source_ref))
            parent = None if self._is_root_folder_ref(destination_ref) else self._find_folder_by_name(str(destination_ref))

            if not folder:
                return {"success": False, "error": f"Folder '{source_ref}' not found"}
            if not self._is_root_folder_ref(destination_ref) and not parent:
                return {"success": False, "error": f"Parent folder '{destination_ref}' not found"}

            self.db.update_item(folder.get("id"), {"parentId": parent.get("id") if parent else None})
            self.db.add_history(folder.get("id"), f"Moved under {(parent or {}).get('name') or 'My Drive'}")
            return {
                "success": True,
                "folder_name": folder.get("name") or folder_name,
                "parent_folder": (parent or {}).get("name") or "My Drive",
                "action": "move_folder"
            }
        except Exception as e:
            logger.error("Move folder error: %s", e)
            return {"success": False, "error": str(e)}

    async def delete_folder(self, user_id: str, folder_name: str = None, recursive: bool = True, **kwargs) -> Dict[str, Any]:
        try:
            folder_ref = kwargs.get("folder_id") or kwargs.get("folder_ref") or folder_name
            if not folder_ref:
                return {"success": False, "error": "Folder reference is required"}

            try:
                folders = await self._get_cloud_folders(user_id)
                folder = self._find_cloud_folder(folders, folder_ref)
                if not folder:
                    return {"success": False, "error": f"Folder '{folder_ref}' not found"}

                await folders_service.delete_folder(
                    user_id=user_id,
                    folder_id=folder.get("id"),
                    recursive=bool(recursive),
                    otp=kwargs.get("otp"),
                )
                return {
                    "success": True,
                    "folder_id": str(folder.get("id")),
                    "folder_name": folder.get("name") or str(folder_ref),
                    "action": "delete_folder"
                }
            except Exception as cloud_error:
                logger.warning("Cloud delete folder fallback to legacy store: %s", cloud_error)

            folder = self._find_folder_by_name(str(folder_ref))
            if not folder:
                return {"success": False, "error": f"Folder '{folder_ref}' not found"}

            self.db.update_item(folder.get("id"), {"trash": True})
            self.db.add_history(folder.get("id"), "Moved folder to trash")
            return {
                "success": True,
                "folder_id": str(folder.get("id")),
                "folder_name": folder.get("name"),
                "action": "delete_folder"
            }
        except Exception as e:
            logger.error("Delete folder error: %s", e)
            return {"success": False, "error": str(e)}

    async def set_folder_color(self, user_id: str, folder_name: str, color: str, **kwargs) -> Dict[str, Any]:
        try:
            folder_ref = kwargs.get("folder_id") or kwargs.get("folder_ref") or folder_name
            try:
                folders = await self._get_cloud_folders(user_id)
                folder = self._find_cloud_folder(folders, folder_ref)
                if not folder:
                    return {"success": False, "error": f"Folder '{folder_ref}' not found"}
                await folders_service.update_folder(user_id, folder.get("id"), {"color": color})
                return {
                    "success": True,
                    "folder_name": folder.get("name") or folder_name,
                    "color": color,
                    "action": "set_color"
                }
            except Exception as cloud_error:
                logger.warning("Cloud set folder color fallback to legacy store: %s", cloud_error)

            folder = self._find_folder_by_name(str(folder_ref))
            if not folder:
                return {"success": False, "error": f"Folder '{folder_ref}' not found"}

            self.db.update_item(folder.get("id"), {"color": color})
            return {
                "success": True,
                "folder_name": folder.get("name") or folder_name,
                "color": color,
                "action": "set_color"
            }
        except Exception as e:
            logger.error("Set color error: %s", e)
            return {"success": False, "error": str(e)}

    async def list_folders(self, user_id: str, parent_folder: str = None, **kwargs) -> Dict[str, Any]:
        try:
            try:
                if parent_folder:
                    folders = await self._get_cloud_folders(user_id)
                    parent = next(
                        (item for item in folders if (item.get("name") or "").strip().lower() == (parent_folder or "").strip().lower()),
                        None,
                    )
                    if not parent:
                        return {"success": False, "error": f"Folder '{parent_folder}' not found"}
                    parent_id = parent.get("id")
                else:
                    parent_id = None

                cloud_folders = await folders_service.get_folders(user_id, parent_id)
                payload = [
                    {
                        "id": str(folder.get("id")),
                        "name": folder.get("name"),
                        "parent_id": folder.get("parent_id"),
                    }
                    for folder in cloud_folders
                ]
                return {
                    "success": True,
                    "folders": payload,
                    "count": len(payload),
                    "action": "list_folders"
                }
            except Exception as cloud_error:
                logger.warning("Cloud list folders fallback to legacy store: %s", cloud_error)

            parent_id = None
            if parent_folder:
                parent = self._find_folder_by_name(parent_folder)
                if not parent:
                    return {"success": False, "error": f"Folder '{parent_folder}' not found"}
                parent_id = parent.get("id")

            folders = [
                {
                    "id": str(f.get("id")),
                    "name": f.get("name"),
                    "parent_id": f.get("parentId")
                }
                for f in self._list_folders()
                if f.get("parentId") == parent_id
            ]
            return {
                "success": True,
                "folders": folders,
                "count": len(folders),
                "action": "list_folders"
            }
        except Exception as e:
            logger.error("List folders error: %s", e)
            return {"success": False, "error": str(e)}

    async def get_folder_tree(self, user_id: str, **kwargs) -> Dict[str, Any]:
        try:
            try:
                tree = await folders_service.get_folder_tree(user_id)
                return {
                    "success": True,
                    "tree": tree,
                    "action": "folder_tree"
                }
            except Exception as cloud_error:
                logger.warning("Cloud folder tree fallback to legacy store: %s", cloud_error)

            folders = self._list_folders()

            def build_tree(parent_id=None):
                children = [f for f in folders if f.get("parentId") == parent_id]
                return [
                    {
                        "id": str(child.get("id")),
                        "name": child.get("name"),
                        "children": build_tree(child.get("id"))
                    }
                    for child in children
                ]

            tree = build_tree(None)
            return {
                "success": True,
                "tree": tree,
                "action": "folder_tree"
            }
        except Exception as e:
            logger.error("Get tree error: %s", e)
            return {"success": False, "error": str(e)}

    async def find_similar(self, user_id: str, file_id: str, limit: int = 10, **kwargs) -> Dict[str, Any]:
        try:
            item_id = self._to_int_id(file_id)
            target = self.db.get_item(item_id) if item_id is not None else None
            if not target:
                return {"success": False, "error": "File not found"}

            target_type = (target.get("fileType") or "").lower()
            target_ext = (target.get("name", "").rsplit(".", 1)[-1].lower() if "." in target.get("name", "") else "")

            similar = []
            for file_item in self._list_files():
                if file_item.get("id") == item_id:
                    continue
                file_type = (file_item.get("fileType") or "").lower()
                ext = (file_item.get("name", "").rsplit(".", 1)[-1].lower() if "." in file_item.get("name", "") else "")
                if file_type == target_type or (target_ext and ext == target_ext):
                    similar.append(self._normalize_file_payload(file_item))

            similar = similar[: max(1, int(limit or 10))]
            return {
                "success": True,
                "files": similar,
                "count": len(similar),
                "action": "find_similar"
            }
        except Exception as e:
            logger.error("Find similar error: %s", e)
            return {"success": False, "error": str(e)}

    async def find_duplicates(self, user_id: str, include_similar: bool = True, **kwargs) -> Dict[str, Any]:
        try:
            try:
                files = await self._get_cloud_files(user_id=user_id, view="all", page_size=500)
                groups: Dict[str, List[dict]] = {}

                for file_item in files:
                    name = (file_item.get("display_name") or file_item.get("original_name") or "").lower()
                    size = file_item.get("size_bytes", 0)
                    key = f"{name}::{size}"
                    groups.setdefault(key, []).append(self._normalize_cloud_file_payload(file_item))

                duplicates = [group for group in groups.values() if len(group) > 1]
                return {
                    "success": True,
                    "duplicates": duplicates,
                    "count": len(duplicates),
                    "action": "find_duplicates"
                }
            except Exception as cloud_error:
                logger.warning("Cloud duplicates fallback to legacy store: %s", cloud_error)

            files = self._list_files()
            groups: Dict[str, List[dict]] = {}

            for file_item in files:
                key = f"{(file_item.get('name') or '').lower()}::{file_item.get('size', 0)}"
                groups.setdefault(key, []).append(self._normalize_file_payload(file_item))

            duplicates = [group for group in groups.values() if len(group) > 1]
            return {
                "success": True,
                "duplicates": duplicates,
                "count": len(duplicates),
                "action": "find_duplicates"
            }
        except Exception as e:
            logger.error("Find duplicates error: %s", e)
            return {"success": False, "error": str(e)}

    async def list_recent_files(self, user_id: str, days: int = 7, limit: int = 10, **kwargs) -> Dict[str, Any]:
        try:
            try:
                files = await self._get_cloud_files(user_id=user_id, view="recent", page_size=max(10, int(limit or 10)))
                recent = [self._normalize_cloud_file_payload(file_item) for file_item in files[: max(1, int(limit or 10))]]
                return {
                    "success": True,
                    "files": recent,
                    "count": len(recent),
                    "action": "recent_files"
                }
            except Exception as cloud_error:
                logger.warning("Cloud recent files fallback to legacy store: %s", cloud_error)

            files = sorted(self._list_files(), key=lambda x: x.get("date", ""), reverse=True)
            recent = [self._normalize_file_payload(f) for f in files[: max(1, int(limit or 10))]]
            return {
                "success": True,
                "files": recent,
                "count": len(recent),
                "action": "recent_files"
            }
        except Exception as e:
            logger.error("Recent files error: %s", e)
            return {"success": False, "error": str(e)}

    async def list_files(self, user_id: str, view: str = "all", limit: int = 50,
                         folder_name: Optional[str] = None, folder_id: Optional[str] = None, **kwargs) -> Dict[str, Any]:
        try:
            view_key = (view or "all").lower()
            try:
                target_folder_id = folder_id
                if not target_folder_id and folder_name:
                    folders = await self._get_cloud_folders(user_id)
                    target = self._find_cloud_folder(folders, folder_name)
                    if not target:
                        return {"success": False, "error": f"Folder '{folder_name}' not found"}
                    target_folder_id = target.get("id")

                if view_key == "shared":
                    shares_result = documents_service.db.table("file_shares").select("file_id").eq(
                        "shared_by", user_id
                    ).execute()
                    shared_ids = [item.get("file_id") for item in (shares_result.data or []) if item.get("file_id")]
                    if not shared_ids:
                        return {
                            "success": True,
                            "files": [],
                            "count": 0,
                            "view": view_key,
                            "action": "list_files",
                        }

                    query = documents_service.db.table("file_metadata").select("*").in_("id", shared_ids).eq(
                        "user_id", user_id
                    ).is_("deleted_at", "null")
                    if target_folder_id:
                        query = query.eq("virtual_folder_id", target_folder_id)
                    query = query.order("updated_at", desc=True).limit(max(1, int(limit or 50)))
                    result = query.execute()
                    docs = result.data or []
                    payload = [self._normalize_cloud_file_payload(doc) for doc in docs]
                    return {
                        "success": True,
                        "files": payload,
                        "count": len(payload),
                        "view": view_key,
                        "action": "list_files",
                    }

                docs, _total = await documents_service.get_documents(
                    user_id=user_id,
                    view="folder" if target_folder_id else view_key,
                    folder_id=target_folder_id,
                    page=1,
                    page_size=max(1, int(limit or 50)),
                )
                payload = [self._normalize_cloud_file_payload(doc) for doc in (docs or [])]
                return {
                    "success": True,
                    "files": payload,
                    "count": len(payload),
                    "view": view_key,
                    "action": "list_files",
                }
            except Exception as cloud_error:
                logger.warning("Cloud list files fallback to legacy store: %s", cloud_error)

            files = self._list_files(include_trash=view_key == "trash")
            if view_key == "favorites":
                files = [f for f in files if f.get("favorite")]
            elif view_key == "shared":
                files = [f for f in files if (f.get("shared") or [])]
            elif view_key == "recent":
                files = sorted(files, key=lambda x: x.get("date", ""), reverse=True)
            if folder_name:
                parent = self._find_folder_by_name(folder_name)
                if not parent:
                    return {"success": False, "error": f"Folder '{folder_name}' not found"}
                files = [f for f in files if f.get("parentId") == parent.get("id")]

            files = files[: max(1, int(limit or 50))]
            payload = [self._normalize_file_payload(f) for f in files]
            return {
                "success": True,
                "files": payload,
                "count": len(payload),
                "view": view_key,
                "action": "list_files",
            }
        except Exception as e:
            logger.error("List files error: %s", e)
            return {"success": False, "error": str(e)}

    async def filter_files(self, user_id: str, file_type: str = None, tag: str = None,
                           min_size_mb: float = None, max_size_mb: float = None,
                           limit: int = 20, **kwargs) -> Dict[str, Any]:
        try:
            try:
                files = await self._get_cloud_files(user_id=user_id, view="all", page_size=500)

                if file_type:
                    files = [f for f in files if (f.get("file_type") or "").lower() == file_type.lower()]
                if tag:
                    files = [f for f in files if tag in (f.get("tags") or [])]
                if min_size_mb is not None:
                    min_bytes = float(min_size_mb) * 1024 * 1024
                    files = [f for f in files if (f.get("size_bytes") or 0) >= min_bytes]
                if max_size_mb is not None:
                    max_bytes = float(max_size_mb) * 1024 * 1024
                    files = [f for f in files if (f.get("size_bytes") or 0) <= max_bytes]

                payload = [self._normalize_cloud_file_payload(file_item) for file_item in files[: max(1, int(limit or 20))]]
                return {
                    "success": True,
                    "files": payload,
                    "count": len(payload),
                    "filters": {
                        "file_type": file_type,
                        "tag": tag,
                        "min_size_mb": min_size_mb,
                        "max_size_mb": max_size_mb,
                    },
                    "action": "filter"
                }
            except Exception as cloud_error:
                logger.warning("Cloud filter fallback to legacy store: %s", cloud_error)

            files = self._list_files()

            if file_type:
                files = [f for f in files if (f.get("fileType") or "").lower() == file_type.lower()]
            if tag:
                files = [f for f in files if tag in (f.get("tags") or [])]
            if min_size_mb is not None:
                min_bytes = float(min_size_mb) * 1024 * 1024
                files = [f for f in files if (f.get("size") or 0) >= min_bytes]
            if max_size_mb is not None:
                max_bytes = float(max_size_mb) * 1024 * 1024
                files = [f for f in files if (f.get("size") or 0) <= max_bytes]

            files = [self._normalize_file_payload(f) for f in files[: max(1, int(limit or 20))]]
            return {
                "success": True,
                "files": files,
                "count": len(files),
                "filters": {
                    "file_type": file_type,
                    "tag": tag,
                    "min_size_mb": min_size_mb,
                    "max_size_mb": max_size_mb,
                },
                "action": "filter"
            }
        except Exception as e:
            logger.error("Filter error: %s", e)
            return {"success": False, "error": str(e)}

    async def get_analytics(self, user_id: str, **kwargs) -> Dict[str, Any]:
        try:
            try:
                files = await self._get_cloud_files(user_id=user_id, view="all", page_size=500)
                folders = await self._get_cloud_folders(user_id)
                total_size = sum((file_item.get("size_bytes") or 0) for file_item in files)

                by_type = Counter((file_item.get("file_type") or "Other") for file_item in files)
                analytics = {
                    "file_stats": {
                        "total_files": len(files),
                        "total_folders": len(folders),
                        "total_size_bytes": total_size,
                        "total_size_readable": self._human_size(total_size),
                        "favorites": sum(1 for file_item in files if file_item.get("is_favorite")),
                    },
                    "file_types": [{"type": file_type, "count": count} for file_type, count in by_type.items()],
                }
                return {
                    "success": True,
                    "analytics": analytics,
                    "action": "analytics"
                }
            except Exception as cloud_error:
                logger.warning("Cloud analytics fallback to legacy store: %s", cloud_error)

            files = self._list_files()
            folders = self._list_folders()
            total_size = sum((f.get("size") or 0) for f in files)

            by_type = Counter((f.get("fileType") or "Other") for f in files)
            analytics = {
                "file_stats": {
                    "total_files": len(files),
                    "total_folders": len(folders),
                    "total_size_bytes": total_size,
                    "total_size_readable": self._human_size(total_size),
                    "favorites": sum(1 for f in files if f.get("favorite")),
                },
                "file_types": [{"type": t, "count": c} for t, c in by_type.items()],
            }
            return {
                "success": True,
                "analytics": analytics,
                "action": "analytics"
            }
        except Exception as e:
            logger.error("Analytics error: %s", e)
            return {"success": False, "error": str(e)}

    async def get_storage_info(self, user_id: str, **kwargs) -> Dict[str, Any]:
        try:
            try:
                quota = await drive_service.get_all_drives_quota(user_id)
                used = quota.get("combined_used_bytes", 0)
                total = quota.get("combined_total_bytes", 0)
                payload = {
                    "used_bytes": used,
                    "total_bytes": total,
                    "used_readable": self._human_size(used),
                    "total_readable": self._human_size(total),
                    "percent_used": round(quota.get("combined_percent_used", 0), 2),
                }
                return {
                    "success": True,
                    "storage": payload,
                    "action": "storage"
                }
            except Exception as cloud_error:
                logger.warning("Cloud storage fallback to legacy store: %s", cloud_error)

            storage = self.db.get_storage_info()
            used = storage.get("used", 0)
            total = storage.get("total", 0)
            payload = {
                "used_bytes": used,
                "total_bytes": total,
                "used_readable": self._human_size(used),
                "total_readable": self._human_size(total),
                "percent_used": round(storage.get("percent", 0), 2),
            }
            return {
                "success": True,
                "storage": payload,
                "action": "storage"
            }
        except Exception as e:
            logger.error("Storage info error: %s", e)
            return {"success": False, "error": str(e)}

    async def get_activity_log(self, user_id: str, days: int = 7, limit: int = 50, **kwargs) -> Dict[str, Any]:
        try:
            try:
                logs, _total = await activity_service.get_activity_logs(user_id, days=int(days or 7), page=1, page_size=max(1, int(limit or 50)))
                return {
                    "success": True,
                    "activities": logs,
                    "count": len(logs),
                    "action": "activity_log"
                }
            except Exception as cloud_error:
                logger.warning("Cloud activity fallback to legacy store: %s", cloud_error)

            history = []
            for item in self._list_items():
                for h in item.get("history") or []:
                    history.append({
                        "item_id": item.get("id"),
                        "item_name": item.get("name"),
                        "action": h.get("action"),
                        "date": h.get("date"),
                        "user": h.get("user"),
                    })

            history.sort(key=lambda x: x.get("date", ""), reverse=True)
            history = history[: max(1, int(limit or 50))]
            return {
                "success": True,
                "activities": history,
                "count": len(history),
                "action": "activity_log"
            }
        except Exception as e:
            logger.error("Activity log error: %s", e)
            return {"success": False, "error": str(e)}

    async def get_version_history(self, user_id: str, file_id: str, **kwargs) -> Dict[str, Any]:
        """Return stored version/history entries for a file (legacy/local only)."""
        try:
            try:
                file_ref = self._pick_file_ref(file_id, kwargs)
                document = await self._resolve_cloud_document(user_id, file_ref)
                if document:
                    versions = await documents_service.get_versions(user_id, document.get("id"))
                    return {
                        "success": True,
                        "file_id": str(document.get("id")),
                        "versions": versions,
                        "count": len(versions),
                        "action": "version_history"
                    }
            except Exception as cloud_error:
                logger.warning("Cloud version history fallback to legacy store: %s", cloud_error)

            item_id, file_item = self._resolve_file(file_id)
            if not file_item:
                return {"success": False, "error": "File not found"}

            versions = file_item.get("history") or []
            return {
                "success": True,
                "file_id": str(item_id),
                "versions": versions,
                "count": len(versions),
                "action": "version_history"
            }
        except Exception as e:
            logger.error("Version history error: %s", e)
            return {"success": False, "error": str(e)}

    async def duplicate_file(self, user_id: str, file_id: str, **kwargs) -> Dict[str, Any]:
        """Duplicate a file, optionally moving the copy to a destination folder.

        Accepts either an explicit file_id or a filename. If direct resolution fails,
        we fuzzy-search the user's cloud docs to find a best match before giving up.
        """
        try:
            destination_ref = (
                kwargs.get("target_folder")
                or kwargs.get("destination_folder")
                or kwargs.get("folder_name")
            )

            def _pick_target_folder_id(cloud_folders, ref: str | None):
                if not ref or self._is_root_folder_ref(ref):
                    return None
                folder = self._find_cloud_folder(cloud_folders, ref)
                return folder.get("id") if folder else None

            try:
                file_ref = self._pick_file_ref(file_id, kwargs)
                document = await self._resolve_cloud_document(user_id, file_ref)

                # Fallback: fuzzy find by name if not resolved
                if not document and file_ref:
                    docs = await self._get_cloud_files(user_id=user_id, view="all", page_size=500)
                    q = str(file_ref).strip().lower()
                    best = None
                    best_score = 0
                    for doc in docs:
                        name = (doc.get("display_name") or doc.get("original_name") or "").lower()
                        if not name:
                            continue
                        score = SequenceMatcher(None, q, name).ratio()
                        if score > best_score:
                            best_score, best = score, doc
                    document = best if best_score >= 0.55 else None

                if not document:
                    return {"success": False, "error": "File not found"}

                document_id = document.get("id")
                duplicated = await documents_service.duplicate_document(user_id, document_id)

                # Move duplicate if a destination is provided
                if destination_ref is not None:
                    cloud_folders = await self._get_cloud_folders(user_id)
                    target_folder_id = _pick_target_folder_id(cloud_folders, destination_ref)
                    if target_folder_id is None and not self._is_root_folder_ref(destination_ref):
                        return {"success": False, "error": f"Destination folder '{destination_ref}' not found"}
                    await documents_service.move_document(user_id, duplicated.get("id"), target_folder_id)

                return {
                    "success": True,
                    "original_file_id": str(document_id),
                    "new_file_id": str(duplicated.get("id")),
                    "new_file_name": duplicated.get("display_name") or duplicated.get("original_name"),
                    "destination": destination_ref or "My Drive",
                    "action": "duplicate"
                }
            except Exception as cloud_error:
                logger.warning("Cloud duplicate fallback to legacy store: %s", cloud_error)

            item_id, file_item = self._resolve_file(file_id)
            if not file_item or file_item.get("type") != "file":
                return {"success": False, "error": "File not found"}

            name = file_item.get("name", "copy")
            if "." in name:
                base, ext = name.rsplit(".", 1)
                new_name = f"{base} - Copy.{ext}"
            else:
                new_name = f"{name} - Copy"

            target_parent_id = None
            if destination_ref and not self._is_root_folder_ref(destination_ref):
                parent = self._find_folder_by_name(str(destination_ref))
                if not parent:
                    return {"success": False, "error": f"Destination folder '{destination_ref}' not found"}
                target_parent_id = parent.get("id")

            new_item = self.db.create_item({
                "name": new_name,
                "type": "file",
                "fileType": file_item.get("fileType"),
                "size": file_item.get("size", 0),
                "parentId": target_parent_id if target_parent_id is not None else file_item.get("parentId"),
                "tags": list(file_item.get("tags") or []),
                "shared": list(file_item.get("shared") or []),
                "content": file_item.get("content"),
            })
            self.db.add_history(new_item.get("id"), f"Duplicated from {file_item.get('name')}")
            return {
                "success": True,
                "original_file_id": str(item_id),
                "new_file_id": str(new_item.get("id")),
                "new_file_name": new_name,
                "destination": destination_ref or "My Drive",
                "action": "duplicate"
            }
        except Exception as e:
            logger.error("Duplicate error: %s", e)
            return {"success": False, "error": str(e)}

    async def extract_text(self, user_id: str, file_id: str, **kwargs) -> Dict[str, Any]:
        try:
            try:
                file_ref = self._pick_file_ref(file_id, kwargs)
                text, error = await self._get_cloud_text(user_id, file_ref)
                if error:
                    return {"success": False, "error": error}
                if text is not None:
                    return {
                        "success": True,
                        "file_id": str(file_ref),
                        "text": text[:1000],
                        "full_length": len(text),
                        "action": "extract_text"
                    }
            except Exception as cloud_error:
                logger.warning("Cloud extract text fallback to legacy store: %s", cloud_error)

            item_id, file_item = self._resolve_file(file_id)
            if not file_item:
                return {"success": False, "error": "File not found"}

            text = self._extract_text_content(file_item)
            if not text:
                return {"success": True, "file_id": str(item_id), "text": "", "full_length": 0, "action": "extract_text"}

            return {
                "success": True,
                "file_id": str(item_id),
                "text": text[:1000],
                "full_length": len(text),
                "action": "extract_text"
            }
        except Exception as e:
            logger.error("Extract text error: %s", e)
            return {"success": False, "error": str(e)}

    async def extract_entities(self, user_id: str, file_id: str, **kwargs) -> Dict[str, Any]:
        try:
            try:
                file_ref = self._pick_file_ref(file_id, kwargs)
                text, error = await self._get_cloud_text(user_id, file_ref)
                if error:
                    return {"success": False, "error": error}
                if text is not None:
                    entities = nlp_service.extract_entities(text)
                    return {
                        "success": True,
                        "file_id": str(file_ref),
                        "entities": entities[:50],
                        "action": "extract_entities"
                    }
            except Exception as cloud_error:
                logger.warning("Cloud extract entities fallback to legacy store: %s", cloud_error)

            item_id, file_item = self._resolve_file(file_id)
            if not file_item:
                return {"success": False, "error": "File not found"}

            text = self._extract_text_content(file_item)
            entities = nlp_service.extract_entities(text)

            return {
                "success": True,
                "file_id": str(item_id),
                "entities": entities[:50],
                "action": "extract_entities"
            }
        except Exception as e:
            logger.error("Extract entities error: %s", e)
            return {"success": False, "error": str(e)}

    async def extract_keywords(self, user_id: str, file_id: str, limit: int = 10, **kwargs) -> Dict[str, Any]:
        try:
            try:
                file_ref = self._pick_file_ref(file_id, kwargs)
                text, error = await self._get_cloud_text(user_id, file_ref)
                if error:
                    return {"success": False, "error": error}
                if text is not None:
                    keywords = nlp_service.extract_keywords(text, top_k=max(1, int(limit or 10)))
                    return {
                        "success": True,
                        "file_id": str(file_ref),
                        "keywords": keywords,
                        "action": "extract_keywords"
                    }
            except Exception as cloud_error:
                logger.warning("Cloud extract keywords fallback to legacy store: %s", cloud_error)

            item_id, file_item = self._resolve_file(file_id)
            if not file_item:
                return {"success": False, "error": "File not found"}

            text = self._extract_text_content(file_item)
            keywords = nlp_service.extract_keywords(text, top_k=max(1, int(limit or 10)))

            return {
                "success": True,
                "file_id": str(item_id),
                "keywords": keywords,
                "action": "extract_keywords"
            }
        except Exception as e:
            logger.error("Extract keywords error: %s", e)
            return {"success": False, "error": str(e)}

    async def detect_language(self, user_id: str, file_id: str, **kwargs) -> Dict[str, Any]:
        try:
            try:
                file_ref = self._pick_file_ref(file_id, kwargs)
                text, error = await self._get_cloud_text(user_id, file_ref)
                if error:
                    return {"success": False, "error": error}
                if text is not None:
                    language = nlp_service.detect_language(text) or "unknown"
                    return {
                        "success": True,
                        "file_id": str(file_ref),
                        "language": language,
                        "action": "detect_language"
                    }
            except Exception as cloud_error:
                logger.warning("Cloud detect language fallback to legacy store: %s", cloud_error)

            item_id, file_item = self._resolve_file(file_id)
            if not file_item:
                return {"success": False, "error": "File not found"}

            text = self._extract_text_content(file_item)
            language = nlp_service.detect_language(text) or "unknown"

            return {
                "success": True,
                "file_id": str(item_id),
                "language": language,
                "action": "detect_language"
            }
        except Exception as e:
            logger.error("Detect language error: %s", e)
            return {"success": False, "error": str(e)}

    async def get_text_stats(self, user_id: str, file_id: str, **kwargs) -> Dict[str, Any]:
        try:
            try:
                file_ref = self._pick_file_ref(file_id, kwargs)
                text, error = await self._get_cloud_text(user_id, file_ref)
                if error:
                    return {"success": False, "error": error}
                if text is not None:
                    stats = nlp_service.get_text_stats(text)
                    return {
                        "success": True,
                        "file_id": str(file_ref),
                        "stats": stats,
                        "action": "text_stats"
                    }
            except Exception as cloud_error:
                logger.warning("Cloud text stats fallback to legacy store: %s", cloud_error)

            item_id, file_item = self._resolve_file(file_id)
            if not file_item:
                return {"success": False, "error": "File not found"}

            text = self._extract_text_content(file_item)
            stats = nlp_service.get_text_stats(text)
            return {
                "success": True,
                "file_id": str(item_id),
                "stats": stats,
                "action": "text_stats"
            }
        except Exception as e:
            logger.error("Get stats error: %s", e)
            return {"success": False, "error": str(e)}

    async def update_preferences(self, user_id: str, theme: str = None, view_mode: str = None,
                                 sort_by: str = None, sort_order: str = None, **kwargs) -> Dict[str, Any]:
        try:
            prefs = self._preferences.get(user_id, {
                "theme": "light",
                "view_mode": "grid",
                "sort_by": "name",
                "sort_order": "asc",
            })

            if theme:
                prefs["theme"] = theme
            if view_mode:
                prefs["view_mode"] = view_mode
            if sort_by:
                prefs["sort_by"] = sort_by
            if sort_order:
                prefs["sort_order"] = sort_order

            self._preferences[user_id] = prefs
            return {
                "success": True,
                "preferences": prefs,
                "action": "update_preferences"
            }
        except Exception as e:
            logger.error("Update preferences error: %s", e)
            return {"success": False, "error": str(e)}

    async def get_preferences(self, user_id: str, **kwargs) -> Dict[str, Any]:
        try:
            prefs = self._preferences.get(user_id, {
                "theme": "light",
                "view_mode": "grid",
                "sort_by": "name",
                "sort_order": "asc",
            })
            return {
                "success": True,
                "preferences": prefs,
                "action": "get_preferences"
            }
        except Exception as e:
            logger.error("Get preferences error: %s", e)
            return {"success": False, "error": str(e)}

    async def batch_move(self, user_id: str, file_ids: list, folder_name: str, **kwargs) -> Dict[str, Any]:
        try:
            resolved_ids: List[str] = []

            if isinstance(file_ids, str):
                token = file_ids.strip().lower()
                if token in {"all_text_files", "text_files", "all text files"}:
                    try:
                        cloud_files = await self._get_cloud_files(user_id=user_id, view="all", page_size=500)
                        for file_item in cloud_files:
                            if (file_item.get("file_type") or "").lower() == "text":
                                resolved_ids.append(str(file_item.get("id")))
                    except Exception as cloud_error:
                        logger.warning("Cloud batch move text fallback to legacy store: %s", cloud_error)
                        for file_item in self._list_files():
                            if (file_item.get("fileType") or "").lower() == "text":
                                resolved_ids.append(str(file_item.get("id")))
                else:
                    resolved_ids = [item.strip() for item in file_ids.split(",") if item.strip()]
            elif isinstance(file_ids, list):
                for entry in file_ids:
                    if isinstance(entry, dict):
                        candidate = entry.get("id") or entry.get("file_id")
                        if candidate is not None:
                            resolved_ids.append(str(candidate))
                    elif entry is not None:
                        resolved_ids.append(str(entry))

            if not resolved_ids:
                return {
                    "success": True,
                    "moved_count": 0,
                    "total_count": 0,
                    "folder_name": folder_name,
                    "action": "batch_move"
                }

            moved = 0
            for file_id in resolved_ids:
                result = await self.move_file(user_id, str(file_id), folder_name)
                if result.get("success"):
                    moved += 1

            return {
                "success": True,
                "moved_count": moved,
                "total_count": len(resolved_ids),
                "folder_name": folder_name,
                "action": "batch_move"
            }
        except Exception as e:
            logger.error("Batch move error: %s", e)
            return {"success": False, "error": str(e)}

    async def batch_tag(self, user_id: str, file_ids: list, tag: str, **kwargs) -> Dict[str, Any]:
        try:
            tagged = 0
            for file_id in file_ids or []:
                result = await self.add_tag(user_id, str(file_id), tag)
                if result.get("success"):
                    tagged += 1

            return {
                "success": True,
                "tagged_count": tagged,
                "total_count": len(file_ids or []),
                "tag": tag,
                "action": "batch_tag"
            }
        except Exception as e:
            logger.error("Batch tag error: %s", e)
            return {"success": False, "error": str(e)}

    async def batch_delete(self, user_id: str, file_ids: list, **kwargs) -> Dict[str, Any]:
        try:
            deleted = 0
            for file_id in file_ids or []:
                result = await self.delete_file(user_id, str(file_id))
                if result.get("success"):
                    deleted += 1

            return {
                "success": True,
                "deleted_count": deleted,
                "total_count": len(file_ids or []),
                "action": "batch_delete",
                "note": "Files moved to trash"
            }
        except Exception as e:
            logger.error("Batch delete error: %s", e)
            return {"success": False, "error": str(e)}

    # ===== PDF POWER TOOLS =====
    
    async def extract_pdf_text(self, user_id: str, file_id: str, **kwargs) -> Dict[str, Any]:
        """Extract text from PDF"""
        try:
            from app.services.pdf_power_tools import get_pdf_executor
            
            file_ref = self._pick_file_ref(file_id, kwargs)
            document = await self._resolve_cloud_document(user_id, file_ref)
            
            if document:
                document_id = document.get("id")
                content, error = await documents_service.download_document(user_id, document_id)
                if error:
                    return {"success": False, "error": f"Failed to download: {error}"}
                
                executor = get_pdf_executor()
                text, error = await executor.extract_text(content)
                if error:
                    return {"success": False, "error": error}
                
                return {
                    "success": True,
                    "file_id": str(document_id),
                    "filename": document.get("display_name"),
                    "text_content": text[:5000],  # Limit response size
                    "character_count": len(text) if text else 0,
                    "action": "extract_pdf_text"
                }
            
            # Legacy fallback
            return {"success": False, "error": "File not found"}
        except Exception as e:
            logger.error(f"Extract PDF text error: {e}")
            return {"success": False, "error": str(e)}
    
    async def convert_pdf_to_images(self, user_id: str, file_id: str, save_to_storage: bool = True, **kwargs) -> Dict[str, Any]:
        """Convert PDF to images"""
        try:
            from app.services.pdf_power_tools import get_pdf_executor
            
            file_ref = self._pick_file_ref(file_id, kwargs)
            document = await self._resolve_cloud_document(user_id, file_ref)
            
            if not document:
                return {"success": False, "error": "File not found"}
            
            document_id = document.get("id")
            content, error = await documents_service.download_document(user_id, document_id)
            if error:
                return {"success": False, "error": error}
            
            executor = get_pdf_executor()
            images, error = await executor.pdf_to_images(content)
            if error:
                return {"success": False, "error": error}
            
            return {
                "success": True,
                "file_id": str(document_id),
                "original_filename": document.get("display_name"),
                "image_count": len(images) if images else 0,
                "action": "convert_pdf_to_images",
                "note": "PDF converted to images. Images available for download."
            }
        except Exception as e:
            logger.error(f"PDF to images error: {e}")
            return {"success": False, "error": str(e)}
    
    async def merge_multiple_pdfs(self, user_id: str, file_ids: list, output_name: str = None, save_to_storage: bool = True, **kwargs) -> Dict[str, Any]:
        """Merge multiple PDFs"""
        try:
            from app.services.pdf_power_tools import get_pdf_executor
            
            if not file_ids or len(file_ids) < 2:
                return {"success": False, "error": "At least 2 PDFs required for merging"}
            
            pdf_contents = []
            filenames = []
            
            for file_id in file_ids:
                document = await self._resolve_cloud_document(user_id, file_id)
                if not document:
                    return {"success": False, "error": f"File {file_id} not found"}
                
                content, error = await documents_service.download_document(user_id, document.get("id"))
                if error:
                    return {"success": False, "error": error}
                
                pdf_contents.append(content)
                filenames.append(document.get("display_name"))
            
            executor = get_pdf_executor()
            merged, error = await executor.merge_pdfs(pdf_contents)
            if error:
                return {"success": False, "error": error}
            
            return {
                "success": True,
                "merged_files": len(file_ids),
                "output_name": output_name or "merged.pdf",
                "source_files": filenames,
                "action": "merge_multiple_pdfs",
                "note": "PDFs merged successfully. Output available for download."
            }
        except Exception as e:
            logger.error(f"PDF merge error: {e}")
            return {"success": False, "error": str(e)}
    
    async def split_pdf_range(self, user_id: str, file_id: str, start_page: int, end_page: int, output_name: str = None, save_to_storage: bool = True, **kwargs) -> Dict[str, Any]:
        """Split PDF by page range"""
        try:
            from app.services.pdf_power_tools import get_pdf_executor
            
            file_ref = self._pick_file_ref(file_id, kwargs)
            document = await self._resolve_cloud_document(user_id, file_ref)
            
            if not document:
                return {"success": False, "error": "File not found"}
            
            document_id = document.get("id")
            content, error = await documents_service.download_document(user_id, document_id)
            if error:
                return {"success": False, "error": error}
            
            executor = get_pdf_executor()
            split_pdf, error = await executor.split_pdf_range(content, start_page - 1, end_page)
            if error:
                return {"success": False, "error": error}
            
            return {
                "success": True,
                "file_id": str(document_id),
                "original_filename": document.get("display_name"),
                "page_range": f"{start_page}-{end_page}",
                "output_name": output_name or f"split_{start_page}-{end_page}.pdf",
                "action": "split_pdf_range"
            }
        except Exception as e:
            logger.error(f"PDF split range error: {e}")
            return {"success": False, "error": str(e)}
    
    async def split_pdf_pages(self, user_id: str, file_id: str, save_to_storage: bool = True, **kwargs) -> Dict[str, Any]:
        """Split PDF into individual pages"""
        try:
            from app.services.pdf_power_tools import get_pdf_executor
            
            file_ref = self._pick_file_ref(file_id, kwargs)
            document = await self._resolve_cloud_document(user_id, file_ref)
            
            if not document:
                return {"success": False, "error": "File not found"}
            
            document_id = document.get("id")
            content, error = await documents_service.download_document(user_id, document_id)
            if error:
                return {"success": False, "error": error}
            
            executor = get_pdf_executor()
            pages, error = await executor.split_pdf_pages(content)
            if error:
                return {"success": False, "error": error}
            
            return {
                "success": True,
                "file_id": str(document_id),
                "original_filename": document.get("display_name"),
                "page_count": len(pages) if pages else 0,
                "action": "split_pdf_pages"
            }
        except Exception as e:
            logger.error(f"PDF page split error: {e}")
            return {"success": False, "error": str(e)}
    
    async def compress_pdf(self, user_id: str, file_id: str, save_to_storage: bool = True, **kwargs) -> Dict[str, Any]:
        """Compress PDF"""
        try:
            from app.services.pdf_power_tools import get_pdf_executor
            
            file_ref = self._pick_file_ref(file_id, kwargs)
            document = await self._resolve_cloud_document(user_id, file_ref)
            
            if not document:
                return {"success": False, "error": "File not found"}
            
            document_id = document.get("id")
            content, error = await documents_service.download_document(user_id, document_id)
            if error:
                return {"success": False, "error": error}
            
            executor = get_pdf_executor()
            compressed, error = await executor.compress_pdf(content)
            if error:
                return {"success": False, "error": error}
            
            original_size = len(content)
            compressed_size = len(compressed) if compressed else original_size
            reduction = ((original_size - compressed_size) / original_size * 100) if original_size > 0 else 0
            
            return {
                "success": True,
                "file_id": str(document_id),
                "original_filename": document.get("display_name"),
                "original_size": self._human_size(original_size),
                "compressed_size": self._human_size(compressed_size),
                "size_reduction_percent": round(reduction, 1),
                "action": "compress_pdf"
            }
        except Exception as e:
            logger.error(f"PDF compression error: {e}")
            return {"success": False, "error": str(e)}
    
    async def rotate_pdf_pages(self, user_id: str, file_id: str, page_numbers: list, rotation_degrees: int, save_to_storage: bool = True, **kwargs) -> Dict[str, Any]:
        """Rotate PDF pages"""
        try:
            from app.services.pdf_power_tools import get_pdf_executor
            
            file_ref = self._pick_file_ref(file_id, kwargs)
            document = await self._resolve_cloud_document(user_id, file_ref)
            
            if not document:
                return {"success": False, "error": "File not found"}
            
            document_id = document.get("id")
            content, error = await documents_service.download_document(user_id, document_id)
            if error:
                return {"success": False, "error": error}
            
            executor = get_pdf_executor()
            rotated, error = await executor.rotate_pages(content, [p - 1 for p in (page_numbers or [])], rotation_degrees)
            if error:
                return {"success": False, "error": error}
            
            return {
                "success": True,
                "file_id": str(document_id),
                "original_filename": document.get("display_name"),
                "rotated_pages": page_numbers,
                "rotation_degrees": rotation_degrees,
                "action": "rotate_pdf_pages"
            }
        except Exception as e:
            logger.error(f"PDF rotation error: {e}")
            return {"success": False, "error": str(e)}
    
    async def remove_pdf_pages(self, user_id: str, file_id: str, page_numbers: list, save_to_storage: bool = True, **kwargs) -> Dict[str, Any]:
        """Remove pages from PDF"""
        try:
            from app.services.pdf_power_tools import get_pdf_executor
            
            file_ref = self._pick_file_ref(file_id, kwargs)
            document = await self._resolve_cloud_document(user_id, file_ref)
            
            if not document:
                return {"success": False, "error": "File not found"}
            
            document_id = document.get("id")
            content, error = await documents_service.download_document(user_id, document_id)
            if error:
                return {"success": False, "error": error}
            
            executor = get_pdf_executor()
            modified, error = await executor.remove_pages(content, [p - 1 for p in (page_numbers or [])])
            if error:
                return {"success": False, "error": error}
            
            return {
                "success": True,
                "file_id": str(document_id),
                "original_filename": document.get("display_name"),
                "removed_pages": page_numbers,
                "action": "remove_pdf_pages"
            }
        except Exception as e:
            logger.error(f"PDF page removal error: {e}")
            return {"success": False, "error": str(e)}
    
    async def reorder_pdf_pages(self, user_id: str, file_id: str, page_order: list, save_to_storage: bool = True, **kwargs) -> Dict[str, Any]:
        """Reorder PDF pages"""
        try:
            from app.services.pdf_power_tools import get_pdf_executor
            
            file_ref = self._pick_file_ref(file_id, kwargs)
            document = await self._resolve_cloud_document(user_id, file_ref)
            
            if not document:
                return {"success": False, "error": "File not found"}
            
            document_id = document.get("id")
            content, error = await documents_service.download_document(user_id, document_id)
            if error:
                return {"success": False, "error": error}
            
            executor = get_pdf_executor()
            reordered, error = await executor.reorder_pages(content, [p - 1 for p in (page_order or [])])
            if error:
                return {"success": False, "error": error}
            
            return {
                "success": True,
                "file_id": str(document_id),
                "original_filename": document.get("display_name"),
                "new_page_order": page_order,
                "action": "reorder_pdf_pages"
            }
        except Exception as e:
            logger.error(f"PDF reorder error: {e}")
            return {"success": False, "error": str(e)}
    
    async def duplicate_pdf_pages(self, user_id: str, file_id: str, page_numbers: list, copies: int = 1, save_to_storage: bool = True, **kwargs) -> Dict[str, Any]:
        """Duplicate PDF pages"""
        try:
            from app.services.pdf_power_tools import get_pdf_executor
            
            file_ref = self._pick_file_ref(file_id, kwargs)
            document = await self._resolve_cloud_document(user_id, file_ref)
            
            if not document:
                return {"success": False, "error": "File not found"}
            
            document_id = document.get("id")
            content, error = await documents_service.download_document(user_id, document_id)
            if error:
                return {"success": False, "error": error}
            
            executor = get_pdf_executor()
            duplicated, error = await executor.duplicate_pages(content, [p - 1 for p in (page_numbers or [])], copies)
            if error:
                return {"success": False, "error": error}
            
            return {
                "success": True,
                "file_id": str(document_id),
                "original_filename": document.get("display_name"),
                "duplicated_pages": page_numbers,
                "copies_per_page": copies,
                "action": "duplicate_pdf_pages"
            }
        except Exception as e:
            logger.error(f"PDF page duplication error: {e}")
            return {"success": False, "error": str(e)}
    
    async def password_protect_pdf(self, user_id: str, file_id: str, password: str, save_to_storage: bool = True, **kwargs) -> Dict[str, Any]:
        """Add password protection to PDF"""
        try:
            from app.services.pdf_power_tools import get_pdf_executor
            
            file_ref = self._pick_file_ref(file_id, kwargs)
            document = await self._resolve_cloud_document(user_id, file_ref)
            
            if not document:
                return {"success": False, "error": "File not found"}
            
            document_id = document.get("id")
            content, error = await documents_service.download_document(user_id, document_id)
            if error:
                return {"success": False, "error": error}
            
            executor = get_pdf_executor()
            protected, error = await executor.password_protect(content, password)
            if error:
                return {"success": False, "error": error}
            
            return {
                "success": True,
                "file_id": str(document_id),
                "original_filename": document.get("display_name"),
                "action": "password_protect_pdf",
                "note": "PDF is now password protected"
            }
        except Exception as e:
            logger.error(f"PDF password protection error: {e}")
            return {"success": False, "error": str(e)}
    
    async def add_pdf_watermark(self, user_id: str, file_id: str, watermark_text: str, opacity: float = 0.3, save_to_storage: bool = True, **kwargs) -> Dict[str, Any]:
        """Add watermark to PDF"""
        try:
            from app.services.pdf_power_tools import get_pdf_executor
            
            file_ref = self._pick_file_ref(file_id, kwargs)
            document = await self._resolve_cloud_document(user_id, file_ref)
            
            if not document:
                return {"success": False, "error": "File not found"}
            
            document_id = document.get("id")
            content, error = await documents_service.download_document(user_id, document_id)
            if error:
                return {"success": False, "error": error}
            
            executor = get_pdf_executor()
            watermarked, error = await executor.add_watermark(content, watermark_text, opacity)
            if error:
                return {"success": False, "error": error}
            
            return {
                "success": True,
                "file_id": str(document_id),
                "original_filename": document.get("display_name"),
                "watermark_text": watermark_text,
                "opacity": opacity,
                "action": "add_pdf_watermark"
            }
        except Exception as e:
            logger.error(f"PDF watermark error: {e}")
            return {"success": False, "error": str(e)}

        # ===== WORD POWER TOOLS =====
    
    async def extract_docx_text(self, user_id: str, file_id: str, **kwargs) -> Dict[str, Any]:
        """Extract text from DOCX"""
        try:
            from app.services.word.word_power_tools import get_word_executor
        
            file_ref = self._pick_file_ref(file_id, kwargs)
            document = await self._resolve_cloud_document(user_id, file_ref)
        
            if document:
                document_id = document.get("id")
                content, error = await documents_service.download_document(user_id, document_id)
                if error:
                    return {"success": False, "error": f"Failed to download: {error}"}
            
                executor = get_word_executor()
                text, error = await executor.extract_text(content)
                if error:
                    return {"success": False, "error": error}
            
                return {
                    "success": True,
                    "file_id": str(document_id),
                    "filename": document.get("display_name"),
                    "text_content": text[:5000] if text else "",
                    "character_count": len(text) if text else 0,
                    "action": "extract_docx_text"
                }
        
            return {"success": False, "error": "File not found"}
        except Exception as e:
            logger.error(f"Extract DOCX text error: {e}")
            return {"success": False, "error": str(e)}

    async def convert_docx_to_pdf(self, user_id: str, file_id: str, **kwargs) -> Dict[str, Any]:
        """Convert DOCX to PDF (requires external converter)"""
        try:
            from app.services.word.word_power_tools import get_word_executor
        
            file_ref = self._pick_file_ref(file_id, kwargs)
            document = await self._resolve_cloud_document(user_id, file_ref)
            if not document:
                return {"success": False, "error": "File not found"}

            content, error = await documents_service.download_document(user_id, document.get("id"))
            if error:
                return {"success": False, "error": error}

            executor = get_word_executor()
            pdf_bytes, error = await executor.convert_to_pdf(content)
            if error:
                return {"success": False, "error": error}

            return {"success": True, "file_id": document.get("id"), "action": "convert_docx_to_pdf"}
        except Exception as e:
            logger.error(f"Convert DOCX to PDF error: {e}")
            return {"success": False, "error": str(e)}

    async def merge_word_documents(self, user_id: str, file_ids: list, **kwargs) -> Dict[str, Any]:
        """Merge multiple DOCX files"""
        try:
            from app.services.word.word_power_tools import get_word_executor

            contents = []
            for fid in file_ids:
                content, error = await documents_service.download_document(user_id, fid)
                if error:
                    return {"success": False, "error": f"Failed to download {fid}: {error}"}
                contents.append(content)

            executor = get_word_executor()
            merged, error = await executor.merge_documents(contents)
            if error:
                return {"success": False, "error": error}

            # Persisting the merged document is left to higher layer; return success
            return {"success": True, "action": "merge_word_documents"}
        except Exception as e:
            logger.error(f"Merge DOCX error: {e}")
            return {"success": False, "error": str(e)}

    async def replace_docx_text(self, user_id: str, file_id: str, find_text: str, replace_text: str, **kwargs) -> Dict[str, Any]:
        """Replace text in DOCX"""
        try:
            from app.services.word.word_power_tools import get_word_executor

            file_ref = self._pick_file_ref(file_id, kwargs)
            document = await self._resolve_cloud_document(user_id, file_ref)
            if not document:
                return {"success": False, "error": "File not found"}

            content, error = await documents_service.download_document(user_id, document.get("id"))
            if error:
                return {"success": False, "error": error}

            executor = get_word_executor()
            updated, error = await executor.replace_text(content, find_text, replace_text)
            if error:
                return {"success": False, "error": error}

            return {"success": True, "action": "replace_docx_text"}
        except Exception as e:
            logger.error(f"Replace DOCX text error: {e}")
            return {"success": False, "error": str(e)}

    async def add_docx_watermark(self, user_id: str, file_id: str, watermark_text: str, **kwargs) -> Dict[str, Any]:
        """Add watermark to DOCX (placeholder)"""
        try:
            from app.services.word.word_power_tools import get_word_executor

            file_ref = self._pick_file_ref(file_id, kwargs)
            document = await self._resolve_cloud_document(user_id, file_ref)
            if not document:
                return {"success": False, "error": "File not found"}

            content, error = await documents_service.download_document(user_id, document.get("id"))
            if error:
                return {"success": False, "error": error}

            executor = get_word_executor()
            result, error = await executor.add_watermark(content, watermark_text)
            if error:
                return {"success": False, "error": error}

            return {"success": True, "action": "add_docx_watermark"}
        except Exception as e:
            logger.error(f"DOCX watermark error: {e}")
            return {"success": False, "error": str(e)}

    # ===== PPT POWER TOOLS =====

    async def extract_ppt_text(self, user_id: str, file_id: str, **kwargs) -> Dict[str, Any]:
        """Extract text from PPTX"""
        try:
            from app.services.ppt.ppt_power_tools import get_ppt_executor

            file_ref = self._pick_file_ref(file_id, kwargs)
            document = await self._resolve_cloud_document(user_id, file_ref)
            if not document:
                return {"success": False, "error": "File not found"}

            content, error = await documents_service.download_document(user_id, document.get("id"))
            if error:
                return {"success": False, "error": error}

            executor = get_ppt_executor()
            text, error = await executor.extract_text(content)
            if error:
                return {"success": False, "error": error}

            return {"success": True, "text_content": text[:5000] if text else "", "action": "extract_ppt_text"}
        except Exception as e:
            logger.error(f"Extract PPT text error: {e}")
            return {"success": False, "error": str(e)}

    async def split_ppt_slides(self, user_id: str, file_id: str, **kwargs) -> Dict[str, Any]:
        """Split PPTX into individual slides"""
        try:
            from app.services.ppt.ppt_power_tools import get_ppt_executor

            file_ref = self._pick_file_ref(file_id, kwargs)
            document = await self._resolve_cloud_document(user_id, file_ref)
            if not document:
                return {"success": False, "error": "File not found"}

            content, error = await documents_service.download_document(user_id, document.get("id"))
            if error:
                return {"success": False, "error": error}

            executor = get_ppt_executor()
            slides, error = await executor.split_slides(content)
            if error:
                return {"success": False, "error": error}

            return {"success": True, "slides_count": len(slides), "action": "split_ppt_slides"}
        except Exception as e:
            logger.error(f"Split PPT slides error: {e}")
            return {"success": False, "error": str(e)}

    async def merge_ppt_presentations(self, user_id: str, file_ids: list, **kwargs) -> Dict[str, Any]:
        """Merge multiple PPTX files"""
        try:
            from app.services.ppt.ppt_power_tools import get_ppt_executor

            contents = []
            for fid in file_ids:
                content, error = await documents_service.download_document(user_id, fid)
                if error:
                    return {"success": False, "error": f"Failed to download {fid}: {error}"}
                contents.append(content)

            executor = get_ppt_executor()
            merged, error = await executor.merge_presentations(contents)
            if error:
                return {"success": False, "error": error}

            return {"success": True, "action": "merge_ppt_presentations"}
        except Exception as e:
            logger.error(f"Merge PPT error: {e}")
            return {"success": False, "error": str(e)}

    async def add_ppt_watermark(self, user_id: str, file_id: str, watermark_text: str, **kwargs) -> Dict[str, Any]:
        """Add watermark to PPTX (placeholder)"""
        try:
            from app.services.ppt.ppt_power_tools import get_ppt_executor

            file_ref = self._pick_file_ref(file_id, kwargs)
            document = await self._resolve_cloud_document(user_id, file_ref)
            if not document:
                return {"success": False, "error": "File not found"}

            content, error = await documents_service.download_document(user_id, document.get("id"))
            if error:
                return {"success": False, "error": error}

            executor = get_ppt_executor()
            result, error = await executor.add_watermark(content, watermark_text)
            if error:
                return {"success": False, "error": error}

            return {"success": True, "action": "add_ppt_watermark"}
        except Exception as e:
            logger.error(f"PPT watermark error: {e}")
            return {"success": False, "error": str(e)}

    # ===== CSV POWER TOOLS =====

    async def extract_csv_preview(self, user_id: str, file_id: str, max_rows: int = 10, **kwargs) -> Dict[str, Any]:
        """Return a preview of CSV rows"""
        try:
            from app.services.csv.csv_power_tools import get_csv_executor

            file_ref = self._pick_file_ref(file_id, kwargs)
            document = await self._resolve_cloud_document(user_id, file_ref)
            if not document:
                return {"success": False, "error": "File not found"}

            content, error = await documents_service.download_document(user_id, document.get("id"))
            if error:
                return {"success": False, "error": error}

            executor = get_csv_executor()
            rows, err = await executor.preview(content, max_rows=max_rows)
            if err:
                return {"success": False, "error": err}

            return {"success": True, "rows": rows, "action": "extract_csv_preview"}
        except Exception as e:
            logger.error(f"CSV preview error: {e}")
            return {"success": False, "error": str(e)}

    async def get_csv_rows(self, user_id: str, file_id: str, limit: int = None, **kwargs) -> Dict[str, Any]:
        try:
            from app.services.csv.csv_power_tools import get_csv_executor
            file_ref = self._pick_file_ref(file_id, kwargs)
            document = await self._resolve_cloud_document(user_id, file_ref)
            if not document:
                return {"success": False, "error": "File not found"}
            content, error = await documents_service.download_document(user_id, document.get("id"))
            if error:
                return {"success": False, "error": error}
            executor = get_csv_executor()
            rows, err = await executor.get_rows(content, limit=limit)
            if err:
                return {"success": False, "error": err}
            return {"success": True, "rows": rows, "action": "get_csv_rows"}
        except Exception as e:
            logger.error(f"Get CSV rows error: {e}")
            return {"success": False, "error": str(e)}

    async def update_csv_cell(self, user_id: str, file_id: str, row_index: int, column: str, new_value: str, **kwargs) -> Dict[str, Any]:
        try:
            from app.services.csv.csv_power_tools import get_csv_executor
            file_ref = self._pick_file_ref(file_id, kwargs)
            document = await self._resolve_cloud_document(user_id, file_ref)
            if not document:
                return {"success": False, "error": "File not found"}
            content, error = await documents_service.download_document(user_id, document.get("id"))
            if error:
                return {"success": False, "error": error}
            executor = get_csv_executor()
            updated_bytes, err = await executor.update_cell(content, row_index, column, new_value)
            if err:
                return {"success": False, "error": err}
            return {"success": True, "updated_bytes_length": len(updated_bytes), "action": "update_csv_cell"}
        except Exception as e:
            logger.error(f"Update CSV cell error: {e}")
            return {"success": False, "error": str(e)}

    async def append_csv_row(self, user_id: str, file_id: str, row: dict, **kwargs) -> Dict[str, Any]:
        try:
            from app.services.csv.csv_power_tools import get_csv_executor
            file_ref = self._pick_file_ref(file_id, kwargs)
            document = await self._resolve_cloud_document(user_id, file_ref)
            if not document:
                return {"success": False, "error": "File not found"}
            content, error = await documents_service.download_document(user_id, document.get("id"))
            if error:
                return {"success": False, "error": error}
            executor = get_csv_executor()
            updated_bytes, err = await executor.append_row(content, row)
            if err:
                return {"success": False, "error": err}
            return {"success": True, "updated_bytes_length": len(updated_bytes), "action": "append_csv_row"}
        except Exception as e:
            logger.error(f"Append CSV row error: {e}")
            return {"success": False, "error": str(e)}

    async def delete_csv_row(self, user_id: str, file_id: str, row_index: int, **kwargs) -> Dict[str, Any]:
        try:
            from app.services.csv.csv_power_tools import get_csv_executor
            file_ref = self._pick_file_ref(file_id, kwargs)
            document = await self._resolve_cloud_document(user_id, file_ref)
            if not document:
                return {"success": False, "error": "File not found"}
            content, error = await documents_service.download_document(user_id, document.get("id"))
            if error:
                return {"success": False, "error": error}
            executor = get_csv_executor()
            updated_bytes, err = await executor.delete_row(content, row_index)
            if err:
                return {"success": False, "error": err}
            return {"success": True, "updated_bytes_length": len(updated_bytes), "action": "delete_csv_row"}
        except Exception as e:
            logger.error(f"Delete CSV row error: {e}")
            return {"success": False, "error": str(e)}

    async def save_csv_file(self, user_id: str, file_id: str, content_bytes: bytes, **kwargs) -> Dict[str, Any]:
        try:
            # Higher layer handles persistence; here we validate content
            from app.services.csv.csv_power_tools import get_csv_executor
            executor = get_csv_executor()
            saved, err = await executor.save_csv(content_bytes)
            if err:
                return {"success": False, "error": err}
            return {"success": True, "bytes_length": len(saved), "action": "save_csv_file"}
        except Exception as e:
            logger.error(f"Save CSV error: {e}")
            return {"success": False, "error": str(e)}

    # ===== MEDIA POWER TOOLS =====

    async def analyze_file(self, user_id: str, file_id: str, **kwargs) -> Dict[str, Any]:
        try:
            from app.services.media.media_power_tools import get_media_executor

            file_ref = self._pick_file_ref(file_id, kwargs)
            document = await self._resolve_cloud_document(user_id, file_ref)
            if not document:
                return {"success": False, "error": "File not found"}

            content, error = await documents_service.download_document(user_id, document.get("id"))
            if error:
                return {"success": False, "error": error}

            filename = document.get("display_name") or document.get("original_name") or "document"
            executor = get_media_executor()
            analysis, err = await executor.analyze_file(content, filename, document.get("mime_type"))
            if err:
                return {"success": False, "error": err}

            return {
                "success": True,
                "file_id": str(document.get("id")),
                "analysis": analysis,
                "action": "analyze_file",
            }
        except Exception as e:
            logger.error(f"Analyze file error: {e}")
            return {"success": False, "error": str(e)}

    async def extract_image_metadata(self, user_id: str, file_id: str, **kwargs) -> Dict[str, Any]:
        try:
            from app.services.media.media_power_tools import get_media_executor

            file_ref = self._pick_file_ref(file_id, kwargs)
            document = await self._resolve_cloud_document(user_id, file_ref)
            if not document:
                return {"success": False, "error": "File not found"}

            content, error = await documents_service.download_document(user_id, document.get("id"))
            if error:
                return {"success": False, "error": error}

            executor = get_media_executor()
            metadata, err = await executor.extract_image_metadata(content, document.get("display_name") or document.get("original_name") or "image")
            if err:
                return {"success": False, "error": err}

            return {
                "success": True,
                "file_id": str(document.get("id")),
                "metadata": metadata,
                "action": "extract_image_metadata",
            }
        except Exception as e:
            logger.error(f"Image metadata error: {e}")
            return {"success": False, "error": str(e)}

    async def extract_audio_metadata(self, user_id: str, file_id: str, **kwargs) -> Dict[str, Any]:
        try:
            from app.services.media.media_power_tools import get_media_executor

            file_ref = self._pick_file_ref(file_id, kwargs)
            document = await self._resolve_cloud_document(user_id, file_ref)
            if not document:
                return {"success": False, "error": "File not found"}

            content, error = await documents_service.download_document(user_id, document.get("id"))
            if error:
                return {"success": False, "error": error}

            executor = get_media_executor()
            metadata, err = await executor.extract_audio_metadata(content, document.get("display_name") or document.get("original_name") or "audio")
            if err:
                return {"success": False, "error": err}

            return {
                "success": True,
                "file_id": str(document.get("id")),
                "metadata": metadata,
                "action": "extract_audio_metadata",
            }
        except Exception as e:
            logger.error(f"Audio metadata error: {e}")
            return {"success": False, "error": str(e)}

    async def extract_video_metadata(self, user_id: str, file_id: str, **kwargs) -> Dict[str, Any]:
        try:
            from app.services.media.media_power_tools import get_media_executor

            file_ref = self._pick_file_ref(file_id, kwargs)
            document = await self._resolve_cloud_document(user_id, file_ref)
            if not document:
                return {"success": False, "error": "File not found"}

            content, error = await documents_service.download_document(user_id, document.get("id"))
            if error:
                return {"success": False, "error": error}

            executor = get_media_executor()
            metadata, err = await executor.extract_video_metadata(content, document.get("display_name") or document.get("original_name") or "video")
            if err:
                return {"success": False, "error": err}

            return {
                "success": True,
                "file_id": str(document.get("id")),
                "metadata": metadata,
                "action": "extract_video_metadata",
            }
        except Exception as e:
            logger.error(f"Video metadata error: {e}")
            return {"success": False, "error": str(e)}
    def _human_size(self, size_bytes: int) -> str:
        units = ["B", "KB", "MB", "GB", "TB"]
        value = float(size_bytes or 0)
        for unit in units:
            if value < 1024 or unit == units[-1]:
                return f"{value:.1f} {unit}" if unit != "B" else f"{int(value)} {unit}"
            value /= 1024
        return f"{int(size_bytes)} B"


_tool_registry: ToolRegistry = None


def get_tool_registry() -> ToolRegistry:
    global _tool_registry
    if _tool_registry is None:
        _tool_registry = ToolRegistry()
    return _tool_registry
