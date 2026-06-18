"""
CSV Power Tools Executor
Provides basic CSV open/read/edit/save operations without external deps.
"""
import io
import csv
import logging
from typing import Tuple, Optional, List, Dict, Any

logger = logging.getLogger(__name__)


class CsvPowerToolsExecutor:
    def __init__(self):
        pass

    async def preview(self, content: bytes, max_rows: int = 10) -> Tuple[Optional[List[Dict[str, Any]]], Optional[str]]:
        try:
            text = content.decode("utf-8")
            f = io.StringIO(text)
            reader = csv.DictReader(f)
            rows = []
            for i, r in enumerate(reader):
                if i >= max_rows:
                    break
                rows.append(r)
            return rows, None
        except Exception as e:
            logger.error("CSV preview error: %s", e)
            return None, str(e)

    async def get_rows(self, content: bytes, limit: Optional[int] = None) -> Tuple[Optional[List[Dict[str, Any]]], Optional[str]]:
        try:
            text = content.decode("utf-8")
            f = io.StringIO(text)
            reader = csv.DictReader(f)
            rows = []
            for i, r in enumerate(reader):
                if limit is not None and i >= limit:
                    break
                rows.append(r)
            return rows, None
        except Exception as e:
            logger.error("CSV get_rows error: %s", e)
            return None, str(e)

    async def update_cell(self, content: bytes, row_index: int, column: str, new_value: str) -> Tuple[Optional[bytes], Optional[str]]:
        try:
            text = content.decode("utf-8")
            f = io.StringIO(text)
            reader = csv.DictReader(f)
            rows = list(reader)
            if row_index < 0 or row_index >= len(rows):
                return None, "Row index out of range"
            if column not in rows[0]:
                return None, "Column not found"
            rows[row_index][column] = new_value
            out = io.StringIO()
            writer = csv.DictWriter(out, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(rows)
            return out.getvalue().encode("utf-8"), None
        except Exception as e:
            logger.error("CSV update_cell error: %s", e)
            return None, str(e)

    async def append_row(self, content: bytes, row: Dict[str, Any]) -> Tuple[Optional[bytes], Optional[str]]:
        try:
            text = content.decode("utf-8")
            f = io.StringIO(text)
            reader = csv.DictReader(f)
            rows = list(reader)
            fieldnames = reader.fieldnames or list(row.keys())
            # Ensure row has keys
            new_row = {k: row.get(k, "") for k in fieldnames}
            rows.append(new_row)
            out = io.StringIO()
            writer = csv.DictWriter(out, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
            return out.getvalue().encode("utf-8"), None
        except Exception as e:
            logger.error("CSV append_row error: %s", e)
            return None, str(e)

    async def delete_row(self, content: bytes, row_index: int) -> Tuple[Optional[bytes], Optional[str]]:
        try:
            text = content.decode("utf-8")
            f = io.StringIO(text)
            reader = csv.DictReader(f)
            rows = list(reader)
            if row_index < 0 or row_index >= len(rows):
                return None, "Row index out of range"
            rows.pop(row_index)
            out = io.StringIO()
            writer = csv.DictWriter(out, fieldnames=rows[0].keys() if rows else [])
            if rows:
                writer.writeheader()
                writer.writerows(rows)
            else:
                # Write empty content
                out = io.StringIO()
            return out.getvalue().encode("utf-8"), None
        except Exception as e:
            logger.error("CSV delete_row error: %s", e)
            return None, str(e)

    async def save_csv(self, content: bytes) -> Tuple[Optional[bytes], Optional[str]]:
        # Saving is identity; higher layers handle storage
        try:
            return content, None
        except Exception as e:
            logger.error("CSV save error: %s", e)
            return None, str(e)


_executor: CsvPowerToolsExecutor = None


def get_csv_executor() -> CsvPowerToolsExecutor:
    global _executor
    if _executor is None:
        _executor = CsvPowerToolsExecutor()
    return _executor
