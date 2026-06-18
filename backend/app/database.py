import json
from typing import List, Optional
from datetime import datetime
from pathlib import Path
from .models import Document, HistoryItem, SharedItem

BACKEND_ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = BACKEND_ROOT / "docmatrix_data.json"

# Default items - Start with empty workspace
DEFAULT_ITEMS = []


class Database:
    def __init__(self):
        self.items: List[dict] = []
        self.load_data()
    
    def load_data(self):
        if DATA_FILE.exists():
            try:
                with DATA_FILE.open('r', encoding='utf-8') as f:
                    self.items = json.load(f)
            except:
                self.items = DEFAULT_ITEMS.copy()
        else:
            self.items = DEFAULT_ITEMS.copy()
            self.save_data()
    
    def save_data(self):
        DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
        with DATA_FILE.open('w', encoding='utf-8') as f:
            json.dump(self.items, f, indent=2)
    
    def get_all_items(self) -> List[dict]:
        return self.items
    
    def get_item(self, item_id: int) -> Optional[dict]:
        for item in self.items:
            if item["id"] == item_id:
                return item
        return None
    
    def get_items_by_parent(self, parent_id: Optional[int], include_trash: bool = False) -> List[dict]:
        return [
            item for item in self.items 
            if item["parentId"] == parent_id and (include_trash or not item.get("trash", False))
        ]
    
    def get_recent_files(self, limit: int = 10) -> List[dict]:
        files = [item for item in self.items if item["type"] == "file" and not item.get("trash", False)]
        files.sort(key=lambda x: x["date"], reverse=True)
        return files[:limit]
    
    def get_favorites(self) -> List[dict]:
        return [item for item in self.items if item.get("favorite", False) and not item.get("trash", False)]
    
    def get_shared_items(self) -> List[dict]:
        return [item for item in self.items if item.get("shared", []) and not item.get("trash", False)]
    
    def get_trash_items(self) -> List[dict]:
        return [item for item in self.items if item.get("trash", False)]
    
    def get_items_by_tag(self, tag: str) -> List[dict]:
        return [item for item in self.items if tag in item.get("tags", []) and not item.get("trash", False)]
    
    def search_items(self, query: str) -> List[dict]:
        query = query.lower()
        return [
            item for item in self.items 
            if query in item["name"].lower() and not item.get("trash", False)
        ]
    
    def create_item(self, item_data: dict) -> dict:
        new_id = max([item["id"] for item in self.items], default=0) + 1
        now = datetime.now()
        new_item = {
            "id": new_id,
            "name": item_data["name"],
            "type": item_data["type"],
            "fileType": item_data.get("fileType"),
            "size": item_data.get("size", 0),
            "date": now.strftime("%Y-%m-%d"),
            "created": now.strftime("%Y-%m-%d"),
            "parentId": item_data.get("parentId"),
            "favorite": item_data.get("favorite", False),
            "tags": item_data.get("tags", []),
            "shared": item_data.get("shared", []),
            "trash": False,
            "content": item_data.get("content"),
            "dataUrl": item_data.get("dataUrl"),
            "mimeType": item_data.get("mimeType"),
            "history": [{"action": "Created", "date": now.strftime("%Y-%m-%d %H:%M"), "user": "Admin"}]
        }
        self.items.append(new_item)
        self.save_data()
        return new_item
    
    def update_item(self, item_id: int, updates: dict) -> Optional[dict]:
        for item in self.items:
            if item["id"] == item_id:
                for key, value in updates.items():
                    if value is not None:
                        item[key] = value
                item["date"] = datetime.now().strftime("%Y-%m-%d")
                self.save_data()
                return item
        return None
    
    def add_history(self, item_id: int, action: str):
        for item in self.items:
            if item["id"] == item_id:
                if "history" not in item:
                    item["history"] = []
                item["history"].append({
                    "action": action,
                    "date": datetime.now().strftime("%Y-%m-%d %H:%M"),
                    "user": "Admin"
                })
                self.save_data()
                break
    
    def delete_item(self, item_id: int) -> bool:
        for i, item in enumerate(self.items):
            if item["id"] == item_id:
                self.items.pop(i)
                self.save_data()
                return True
        return False
    
    def get_storage_info(self) -> dict:
        total_size = sum(item.get("size", 0) for item in self.items if not item.get("trash", False))
        total_capacity = 10 * 1024 * 1024 * 1024  # 10 GB
        return {
            "used": total_size,
            "total": total_capacity,
            "percent": min((total_size / total_capacity) * 100, 100)
        }
    
    def get_trash_count(self) -> int:
        return len([item for item in self.items if item.get("trash", False)])
    
    def empty_trash(self):
        self.items = [item for item in self.items if not item.get("trash", False)]
        self.save_data()
    
    def restore_all_trash(self):
        for item in self.items:
            if item.get("trash", False):
                item["trash"] = False
                self.add_history(item["id"], "Restored from trash")
        self.save_data()


# Singleton instance
db = Database()
