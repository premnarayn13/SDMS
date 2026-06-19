"""Service layer for MEGA account and file operations.

Prototype mode notes:
- User MEGA credentials are encrypted at rest.
- For each request we perform a fresh MEGA login to avoid stale sessions.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from platform import node
from tempfile import NamedTemporaryFile, TemporaryDirectory
from typing import Any, Dict, List, Optional, Tuple
import logging
import os

from mega import Mega

from ...db_supabase import get_service_db
from ...config import settings
from ...utils.security import token_encryption

logger = logging.getLogger(__name__)


@dataclass
class MegaConnection:
    user_id: str
    mega_email: str
    mega_password: str
    folder_name: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class MegaService:
    """MEGA integration service with strict folder isolation per user."""

    TABLE_NAME = "mega_storage_connections"
    ENCRYPTED_PREFIX = "enc::"

    def __init__(self) -> None:
        self.db = get_service_db()

    def _is_security_mode_enabled(self) -> bool:
        mode = (getattr(settings, "MEGA_SECURITY_MODE", "prototype") or "prototype").lower()
        return mode in {"secure", "production"}

    def _ensure_guardrails_for_connect(self) -> None:
        environment = (getattr(settings, "ENVIRONMENT", "development") or "development").lower()
        if environment == "production" and not self._is_security_mode_enabled():
            raise ValueError(
                "MEGA connect is blocked in production because MEGA_SECURITY_MODE is not set to secure. "
                "Set MEGA_SECURITY_MODE=secure and restart the backend."
            )

    def _encrypt_secret(self, value: str) -> str:
        encrypted = token_encryption.encrypt(value)
        return f"{self.ENCRYPTED_PREFIX}{encrypted}"

    def _decrypt_secret(self, value: str) -> str:
        if not value:
            return ""
        # Backward-compatible fallback for older plaintext rows.
        if not value.startswith(self.ENCRYPTED_PREFIX):
            return value
        encrypted = value[len(self.ENCRYPTED_PREFIX):]
        return token_encryption.decrypt(encrypted)

    def _docmatrix_folder(self, user_id: str) -> str:
        return f"DocMatrix_{user_id}"

    def _row_to_connection(self, row: Dict[str, Any]) -> MegaConnection:
        raw_password = str(row.get("mega_password") or "")
        return MegaConnection(
            user_id=str(row.get("user_id")),
            mega_email=str(row.get("mega_email")),
            mega_password=self._decrypt_secret(raw_password),
            folder_name=str(row.get("folder_name")),
            created_at=row.get("created_at"),
            updated_at=row.get("updated_at"),
        )

    def _extract_node(self, value: Any, preferred_key: Optional[str] = None) -> Optional[Any]:
        if value is None:
            return None
        if isinstance(value, (list, tuple)):
            return value[0] if value else None
        if isinstance(value, dict):
            if "h" in value or "a" in value:
                return value
            if preferred_key and preferred_key in value:
                return value.get(preferred_key)
            if value:
                first_key = next(iter(value))
                return value[first_key]
            return None
        return value

    def _node_id(self, node: Any) -> Optional[str]:
        if node is None:
            return None
        if isinstance(node, dict):
            return node.get("h") or node.get("id")
        return str(node)

    def _node_name(self, mega_client: Any, node: Any) -> Optional[str]:
        try:
            if isinstance(node, dict):
                attrs = node.get("a")

                if isinstance(attrs, dict):
                    return attrs.get("n")

            if hasattr(mega_client, "get_name_from_file"):
                return mega_client.get_name_from_file(node)

        except Exception:
            pass

        return None

    def _login(self, email: str, password: str) -> Any:
        print("\n===== LOGIN DEBUG =====")
        print("EMAIL :", repr(email))
        print("PASSWORD LENGTH :", len(password))
        print("PASSWORD :", repr(password))
        print("=======================\n")

        mega = Mega()
        return mega.login(email, password)

    def _ensure_connection_table(self) -> None:
        # If the table does not exist, Supabase raises an error at runtime.
        # We surface a clear message instead of crashing.
        try:
            self.db.table(self.TABLE_NAME).select("user_id").limit(1).execute()
        except Exception as exc:
            raise ValueError(
                "MEGA storage table is missing. Please run the migration for mega_storage_connections before using this feature."
            ) from exc

    def get_connection(self, user_id: str) -> Optional[MegaConnection]:
        self._ensure_connection_table()
        result = self.db.table(self.TABLE_NAME).select("*").eq("user_id", user_id).limit(1).execute()
        if not result.data:
            return None
        row = result.data[0]
        raw_password = str(row.get("mega_password") or "")
        conn = self._row_to_connection(row)
        if raw_password and not raw_password.startswith(self.ENCRYPTED_PREFIX):
            # Silent one-time migration from plaintext rows.
            return self._upsert_connection(conn.user_id, conn.mega_email, conn.mega_password, conn.folder_name)
        return conn

    def _upsert_connection(self, user_id: str, email: str, password: str, folder_name: str) -> MegaConnection:
        self._ensure_connection_table()
        payload = {
            "user_id": user_id,
            "mega_email": email,
            "mega_password": self._encrypt_secret(password),
            "folder_name": folder_name,
            "is_connected": True,
            "last_verified_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }
        result = self.db.table(self.TABLE_NAME).upsert(payload, on_conflict="user_id").execute()
        if not result.data:
            raise ValueError("Failed to persist MEGA connection")
        return self._row_to_connection(result.data[0])

    def _ensure_user_folder(self, mega_client: Any, user_id: str, folder_name: Optional[str] = None) -> Tuple[str, Any]:
        expected = folder_name or self._docmatrix_folder(user_id)
        found = mega_client.find(expected, exclude_deleted=True)
        folder_node = self._extract_node(found)
        if folder_node is not None:
            return expected, folder_node

        created = mega_client.create_folder(expected)
        folder_node = self._extract_node(created, preferred_key=expected)
        if folder_node is None:
            raise ValueError("Could not initialize user folder in MEGA")
        return expected, folder_node

    def connect_and_verify(
        self,
        user_id: str,
        mega_email: str,
        mega_password: str,
        force_reconnect: bool = False,
    ) -> MegaConnection:
        self._ensure_guardrails_for_connect()

        normalized_email = mega_email.strip().lower()
        normalized_password = mega_password.strip()
        if not normalized_email or not normalized_password:
            raise ValueError("Please provide both MEGA email and password.")

        existing = self.get_connection(user_id)
        if existing and existing.mega_email.lower() != normalized_email and not force_reconnect:
            raise ValueError(
                "A different MEGA account is already linked. "
                "Reconnect with force_reconnect=true to switch accounts."
            )

        mega_client = self._login(normalized_email, normalized_password)
        folder_name, _folder_node = self._ensure_user_folder(mega_client, user_id)
        return self._upsert_connection(user_id, normalized_email, normalized_password, folder_name)

    def _login_for_user(self, user_id: str) -> Tuple[MegaConnection, Any, Any]:
        conn = self.get_connection(user_id)
        if not conn:
            raise ValueError("MEGA account is not connected for this user")

        mega_client = self._login(conn.mega_email, conn.mega_password)
        folder_name, folder_node = self._ensure_user_folder(mega_client, user_id, conn.folder_name)

        if folder_name != conn.folder_name:
            conn = self._upsert_connection(user_id, conn.mega_email, conn.mega_password, folder_name)

        return conn, mega_client, folder_node

    def disconnect(self, user_id: str) -> None:
        self._ensure_connection_table()
        self.db.table(self.TABLE_NAME).delete().eq("user_id", user_id).execute()

    def _list_files_in_folder(self, mega_client: Any, folder_node: Any) -> List[Dict[str, Any]]:
        folder_id = self._node_id(folder_node)
        files: List[Dict[str, Any]] = []

        # Preferred if available in mega.py
        if hasattr(mega_client, "get_files_in_node"):
            try:
                node_files = mega_client.get_files_in_node(folder_node)
                if isinstance(node_files, dict):
                    iterable = node_files.items()
                else:
                    iterable = []

                for file_id, meta in iterable:
                    if not isinstance(meta, dict):
                        continue
                    if meta.get("t") != 0:
                        continue
                    print("META =", meta)
                    print("NODE NAME =", self._node_name(mega_client, meta))
                    files.append({
                        "file_id": str(meta.get("h") or file_id),
                        "name": self._node_name(mega_client, meta) or str(meta.get("name") or f"file_{file_id}"),
                        "size_bytes": int(meta.get("s") or 0),
                        "uploaded_at": None,
                        "node": meta,
                    })
                if files:
                    return files
            except Exception:
                logger.debug("get_files_in_node unavailable or failed; falling back to get_files")

        all_files = mega_client.get_files()
        if not isinstance(all_files, dict):
            return []

        for file_id, meta in all_files.items():
            if not isinstance(meta, dict):
                continue
            if meta.get("t") != 0:
                continue
            if folder_id and str(meta.get("p")) != str(folder_id):
                continue
            files.append({
                "file_id": str(meta.get("h") or file_id),
                "name": self._node_name(mega_client, meta) or str(meta.get("name") or f"file_{file_id}"),
                "size_bytes": int(meta.get("s") or 0),
                "uploaded_at": None,
                "node": meta,
            })
        return files

    def list_files(self, user_id: str) -> List[Dict[str, Any]]:
        _conn, mega_client, folder_node = self._login_for_user(user_id)
        files = self._list_files_in_folder(mega_client, folder_node)
        files.sort(key=lambda f: f.get("name", "").lower())
        return files

    def upload_file(
        self,
        user_id: str,
        filename: str,
        content: bytes
    ) -> Dict[str, Any]:

        _conn, mega_client, folder_node = self._login_for_user(user_id)

        temp_path = None
        temp_dir = None

        try:
            import tempfile
            import os

            temp_dir = tempfile.mkdtemp()

            temp_path = os.path.join(
                temp_dir,
                filename
            )

            with open(temp_path, "wb") as temp_file:
                temp_file.write(content)

            logger.warning("MEGA UPLOAD ORIGINAL FILE = %s", filename)
            logger.warning("MEGA UPLOAD TEMP PATH = %s", temp_path)

            uploaded_node = mega_client.upload(
                temp_path,
                folder_node
            )

            logger.warning(
                "MEGA UPLOAD NODE = %s",
                uploaded_node
            )

            uploaded_meta = self._extract_node(uploaded_node)

            file_id = (
                self._node_id(uploaded_meta)
                or self._node_id(uploaded_node)
                or ""
            )

            return {
                "file_id": str(file_id),
                "name": filename,
                "size_bytes": len(content),
                "uploaded_at": datetime.utcnow().isoformat()
            }

        finally:
            try:
                if temp_path and os.path.exists(temp_path):
                    os.remove(temp_path)

                if temp_dir and os.path.exists(temp_dir):
                    os.rmdir(temp_dir)

            except Exception:
                pass

    def _find_file_node(self, user_id: str, file_id: str) -> Tuple[Any, Dict[str, Any]]:
        print("\n===== FIND FILE NODE =====")
        print("REQUESTED FILE ID =", file_id)

        _conn, mega_client, folder_node = self._login_for_user(user_id)

        print("LOGIN SUCCESS")

        files = self._list_files_in_folder(mega_client, folder_node)

        print("FILES FOUND =", len(files))

        match = next(
            (f for f in files if str(f.get("file_id")) == str(file_id)),
            None
        )

        print("MATCH =", match)

        if not match:
            raise ValueError("File not found")

        node = match.get("node")

        print("NODE FROM MATCH =", node)

        return mega_client, match
    
    def download_file(self, user_id: str, file_id: str) -> Tuple[str, str]:
        mega_client, file_entry = self._find_file_node(
            user_id,
            file_id
        )
        print("1. ###################  Don FILE ENTRY =", file_entry)
        #print("2. Don NODE =", node)
        node = file_entry["node"]
        with TemporaryDirectory() as temp_dir:

            try:
                print("3. Don ################ FILE ENTRY =", file_entry)
                print("4. Don ################  NODE =", node)
                print(" ")
                saved_path = mega_client.download(
                    (file_entry["file_id"], node),
                    dest_path=temp_dir
                )

                if not saved_path:
                    raise ValueError("Download failed")
                print("5.####################### Don FILE ENTRY =", file_entry)
                print("6.####################### Don NODE =", node)
                print(" ")
                source = Path(saved_path)

                with NamedTemporaryFile(
                    delete=False,
                    suffix=source.suffix
                ) as out_file:
                    out_file.write(source.read_bytes())
                    final_path = out_file.name

                try:
                    source.unlink()
                except Exception:
                    pass

                filename = (
                    file_entry.get("name")
                    or Path(final_path).name
                )

                return final_path, filename

            except Exception:
                import traceback
                traceback.print_exc()
                raise
        
    
    def delete_file(
        self,
        user_id: str,
        file_id: str
    ) -> None:

        logger.warning("=================================================")
        logger.warning("MEGA DELETE STARTED")
        logger.warning("FILE ID = %s", file_id)
        logger.warning("FILE ID = %s", file_id)

        mega_client, file_entry = self._find_file_node(
            user_id,
            file_id
        )

        logger.warning(
            "FILE ENTRY = %s",
            file_entry
        )

        node = file_entry.get("node")

        logger.warning(
            "NODE = %s",
            node
        )

        if not node:
            raise ValueError("MEGA node not found")

        try:
            node_id = (
                node.get("h")
                if isinstance(node, dict)
                else node
            )

            logger.warning(
                "NODE ID = %s",
                node_id
            )

            if not node_id:
                raise ValueError("Unable to determine MEGA node id")

            mega_client.destroy(node_id)

            logger.warning(
                "MEGA FILE DELETED SUCCESSFULLY -> %s",
                file_id
            )

        except Exception as e:
            logger.exception(
                "MEGA DELETE FAILED -> %s",
                str(e)
            )
            raise

        logger.warning("=================================================")

mega_service = MegaService()
