"""
Media Power Tools Executor
Provides safe, basic inspection utilities for image, audio, and video files.
All operations are read-only and intentionally fall back gracefully when
optional third-party libraries are unavailable.
"""
import io
import os
import json
import wave
import mimetypes
import tempfile
import logging
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

logger = logging.getLogger(__name__)


class MediaPowerToolsExecutor:
    IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".tif", ".tiff", ".svg"}
    AUDIO_EXTENSIONS = {".mp3", ".wav", ".ogg", ".flac", ".m4a", ".aac", ".wma"}
    VIDEO_EXTENSIONS = {".mp4", ".avi", ".mov", ".wmv", ".mkv", ".webm", ".m4v", ".ogv"}
    TEXT_EXTENSIONS = {".pdf", ".doc", ".docx", ".txt", ".md", ".csv", ".ppt", ".pptx"}

    def _extension(self, filename: str) -> str:
        return Path(filename or "").suffix.lower()

    def _category(self, filename: str) -> str:
        ext = self._extension(filename)
        if ext in self.IMAGE_EXTENSIONS:
            return "image"
        if ext in self.AUDIO_EXTENSIONS:
            return "audio"
        if ext in self.VIDEO_EXTENSIONS:
            return "video"
        if ext in self.TEXT_EXTENSIONS:
            return "document"
        return "other"

    def _suggested_operations(self, filename: str) -> list[str]:
        ext = self._extension(filename)
        base_ops = [
            "open_file",
            "download_file",
            "rename_file",
            "move_file",
            "duplicate_file",
            "delete_file",
            "restore_file",
            "toggle_favorite",
            "add_tag",
            "remove_tag",
            "share_file",
            "remove_share",
            "get_file_info",
        ]

        if ext in {".csv"}:
            return base_ops + ["extract_csv_preview", "get_csv_rows", "update_csv_cell", "append_csv_row", "delete_csv_row", "save_csv_file"]
        if ext in {".ppt", ".pptx"}:
            return base_ops + ["extract_ppt_text", "split_ppt_slides", "merge_ppt_presentations", "add_ppt_watermark"]
        if ext in {".doc", ".docx"}:
            return base_ops + ["extract_docx_text", "convert_docx_to_pdf", "merge_word_documents", "replace_docx_text", "add_docx_watermark"]
        if ext in {".pdf"}:
            return base_ops + ["extract_pdf_text", "convert_pdf_to_images", "merge_multiple_pdfs", "split_pdf_range", "split_pdf_pages", "compress_pdf", "rotate_pdf_pages", "remove_pdf_pages", "reorder_pdf_pages", "duplicate_pdf_pages", "add_pdf_watermark"]
        if ext in {".txt", ".md"}:
            return base_ops + ["extract_text", "extract_entities", "extract_keywords", "detect_language", "get_text_stats"]
        if ext in self.IMAGE_EXTENSIONS:
            return base_ops + ["extract_image_metadata", "analyze_file"]
        if ext in self.AUDIO_EXTENSIONS:
            return base_ops + ["extract_audio_metadata", "analyze_file"]
        if ext in self.VIDEO_EXTENSIONS:
            return base_ops + ["extract_video_metadata", "analyze_file"]
        return base_ops + ["analyze_file"]

    async def analyze_file(
        self,
        content: bytes,
        filename: str,
        mime_type: Optional[str] = None,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        try:
            category = self._category(filename)
            ext = self._extension(filename)
            guessed_mime = mime_type or mimetypes.guess_type(filename or "")[0]

            result: Dict[str, Any] = {
                "filename": filename,
                "extension": ext.lstrip("."),
                "category": category,
                "mime_type": guessed_mime,
                "size_bytes": len(content or b""),
                "suggested_operations": self._suggested_operations(filename),
            }

            if category == "image":
                metadata, error = await self.extract_image_metadata(content, filename)
                if error:
                    result["warning"] = error
                if metadata:
                    result["metadata"] = metadata
            elif category == "audio":
                metadata, error = await self.extract_audio_metadata(content, filename)
                if error:
                    result["warning"] = error
                if metadata:
                    result["metadata"] = metadata
            elif category == "video":
                metadata, error = await self.extract_video_metadata(content, filename)
                if error:
                    result["warning"] = error
                if metadata:
                    result["metadata"] = metadata

            return result, None
        except Exception as e:
            logger.error("Media analysis error: %s", e)
            return None, str(e)

    async def extract_image_metadata(self, content: bytes, filename: str) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        try:
            try:
                from PIL import Image
            except ImportError:
                return None, "Pillow is not installed"

            with Image.open(io.BytesIO(content)) as image:
                metadata: Dict[str, Any] = {
                    "format": image.format,
                    "mode": image.mode,
                    "width": image.width,
                    "height": image.height,
                }
                try:
                    exif = image.getexif()
                    if exif:
                        metadata["has_exif"] = True
                        metadata["exif_tags"] = len(exif)
                    else:
                        metadata["has_exif"] = False
                except Exception:
                    metadata["has_exif"] = False

                metadata["filename"] = filename
                return metadata, None
        except Exception as e:
            logger.error("Image metadata error: %s", e)
            return None, str(e)

    async def extract_audio_metadata(self, content: bytes, filename: str) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        try:
            ext = self._extension(filename)
            if ext == ".wav":
                with wave.open(io.BytesIO(content)) as wav_file:
                    frame_count = wav_file.getnframes()
                    sample_rate = wav_file.getframerate() or 1
                    metadata = {
                        "format": "wav",
                        "channels": wav_file.getnchannels(),
                        "sample_rate": sample_rate,
                        "frame_count": frame_count,
                        "duration_seconds": round(frame_count / float(sample_rate), 3),
                    }
                    return metadata, None

            try:
                from mutagen import File as MutagenFile
            except ImportError:
                return {
                    "format": ext.lstrip(".") or "unknown",
                    "size_bytes": len(content),
                    "note": "Install mutagen for richer audio metadata",
                }, None

            audio = MutagenFile(io.BytesIO(content))
            if not audio or not getattr(audio, "info", None):
                return {
                    "format": ext.lstrip(".") or "unknown",
                    "size_bytes": len(content),
                }, None

            info = audio.info
            metadata = {
                "format": ext.lstrip(".") or audio.__class__.__name__,
                "duration_seconds": round(getattr(info, "length", 0) or 0, 3),
                "bitrate": getattr(info, "bitrate", None),
                "sample_rate": getattr(info, "sample_rate", None),
                "channels": getattr(info, "channels", None),
                "size_bytes": len(content),
            }
            return metadata, None
        except Exception as e:
            logger.error("Audio metadata error: %s", e)
            return None, str(e)

    async def extract_video_metadata(self, content: bytes, filename: str) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        temp_path = None
        try:
            try:
                import cv2
            except ImportError:
                cv2 = None

            if not cv2:
                return {
                    "format": self._extension(filename).lstrip(".") or "unknown",
                    "size_bytes": len(content),
                    "note": "Install opencv-python for richer video metadata",
                }, None

            suffix = self._extension(filename) or ".bin"
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                tmp.write(content)
                temp_path = tmp.name

            capture = cv2.VideoCapture(temp_path)
            if not capture.isOpened():
                return {
                    "format": self._extension(filename).lstrip(".") or "unknown",
                    "size_bytes": len(content),
                }, None

            frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
            fps = float(capture.get(cv2.CAP_PROP_FPS) or 0)
            width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
            height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
            duration = round(frame_count / fps, 3) if fps else None
            metadata = {
                "format": self._extension(filename).lstrip(".") or "unknown",
                "frame_count": frame_count,
                "fps": round(fps, 3) if fps else None,
                "duration_seconds": duration,
                "width": width,
                "height": height,
                "size_bytes": len(content),
            }
            capture.release()
            return metadata, None
        except Exception as e:
            logger.error("Video metadata error: %s", e)
            return None, str(e)
        finally:
            if temp_path and os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except Exception:
                    pass


_executor: MediaPowerToolsExecutor = None


def get_media_executor() -> MediaPowerToolsExecutor:
    global _executor
    if _executor is None:
        _executor = MediaPowerToolsExecutor()
    return _executor