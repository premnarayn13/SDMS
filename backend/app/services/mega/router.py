"""API router for MEGA storage integration."""

from datetime import datetime
from pathlib import Path
import os
import time
import logging

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
from dateutil.parser import isoparse

from ...middleware.auth import get_current_user
from ...config import settings
from .schemas import (
    MegaActionResponse,
    MegaConnectRequest,
    MegaConnectResponse,
    MegaFileItem,
    MegaFileListResponse,
    MegaStatusResponse,
)
from .service import mega_service

router = APIRouter(prefix="/mega", tags=["MEGA Storage"])
logger = logging.getLogger(__name__)


def _log_mega_timing(operation: str, started_at: float, user_id: str, success: bool, error: str | None = None) -> None:
    if not getattr(settings, "MEGA_ENABLE_TIMING_LOGS", True):
        return

    duration_ms = int((time.perf_counter() - started_at) * 1000)
    slow_threshold = int(getattr(settings, "MEGA_SLOW_REQUEST_MS", 3000) or 3000)
    is_slow = duration_ms >= slow_threshold

    log_fn = logger.warning if (is_slow or not success) else logger.info
    log_fn(
        "MEGA endpoint operation=%s user_id=%s success=%s duration_ms=%s slow=%s error=%s",
        operation,
        user_id,
        success,
        duration_ms,
        is_slow,
        error,
    )


def _mega_warning_message() -> str:
    return (
        "MEGA credentials are encrypted at rest. "
        "If your MEGA account requires 2FA/OTP challenge, connection may require a manual MEGA web login flow."
    )


def _cleanup_temp_file(path: str) -> None:
    try:
        if path and os.path.exists(path):
            os.remove(path)
    except Exception:
        # Best-effort cleanup
        pass

@router.get("/status", response_model=MegaStatusResponse)
async def mega_status(user: dict = Depends(get_current_user)):
    started_at = time.perf_counter()

    try:
        conn = await run_in_threadpool(
            mega_service.get_connection,
            user["id"]
        )

        _log_mega_timing("status", started_at, user["id"], True)

        return MegaStatusResponse(
            connected=True,
            mega_email=getattr(conn, "mega_email", None),
            folder_name=getattr(conn, "folder_name", None),
            connected_at = isoparse(conn.created_at)
            if getattr(conn, "created_at", None)
            else None,
            warning=_mega_warning_message(),
            security_mode="encrypted",
        )

    except Exception as e:
        logger.exception(f"Failed to fetch MEGA status for user {user.get('id')}")

        _log_mega_timing(
            "status",
            started_at,
            user["id"],
            False,
            str(e)
        )

        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch MEGA status: {e}"
        )

@router.post("/connect-mega", response_model=MegaConnectResponse)
async def connect_mega(payload: MegaConnectRequest, user: dict = Depends(get_current_user)):
    """Connect and verify a user's MEGA account and initialize folder isolation."""
    started_at = time.perf_counter()
    try:
        conn = await run_in_threadpool(
            mega_service.connect_and_verify,
            user["id"],
            payload.mega_email,
            payload.mega_password,
            payload.force_reconnect,
        )
        _log_mega_timing("connect", started_at, user["id"], True)
        return MegaConnectResponse(
            success=True,
            message=(
                "MEGA account reconnected successfully"
                if payload.force_reconnect
                else "MEGA account connected successfully"
            ),
            folder_name=conn.folder_name,
            connected_at=datetime.utcnow(),
            reconnect_required=False,
        )
    except ValueError as exc:
        message = str(exc)
        status_code = 401 if "credential" in message.lower() or "login" in message.lower() else 400
        _log_mega_timing("connect", started_at, user["id"], False, message)
        raise HTTPException(status_code=status_code, detail=message)
    except Exception as exc:
        _log_mega_timing("connect", started_at, user["id"], False, str(exc))
        raise HTTPException(status_code=500, detail=f"MEGA connection failed: {exc}")


@router.delete("/disconnect", response_model=MegaActionResponse)
async def disconnect_mega(user: dict = Depends(get_current_user)):
    """Disconnect user's MEGA account from DocMatrix (does not delete files in MEGA)."""
    started_at = time.perf_counter()
    try:
        await run_in_threadpool(mega_service.disconnect, user["id"])
        _log_mega_timing("disconnect", started_at, user["id"], True)
        return MegaActionResponse(success=True, message="MEGA account disconnected successfully")
    except ValueError as exc:
        _log_mega_timing("disconnect", started_at, user["id"], False, str(exc))
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        _log_mega_timing("disconnect", started_at, user["id"], False, str(exc))
        raise HTTPException(status_code=500, detail=f"Disconnect failed: {exc}")


@router.post("/upload", response_model=MegaActionResponse)
async def upload_to_mega(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """Upload a file into the user's dedicated MEGA DocMatrix folder."""
    started_at = time.perf_counter()
    try:
        logger.info(f"MEGA upload started: filename={file.filename} user_id={user.get('id')}")
        content = await file.read()
        result=await run_in_threadpool(
            mega_service.upload_file,
            user["id"],
            file.filename or "upload.bin",
            content,
        )
        _log_mega_timing("upload", started_at, user["id"], True)
        return {"success": True,"message": "File uploaded to MEGA successfully","file_id": result["file_id"],"name": result["name"],}
    except ValueError as exc:
        _log_mega_timing("upload", started_at, user["id"], False, str(exc))
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        _log_mega_timing("upload", started_at, user["id"], False, str(exc))
        raise HTTPException(status_code=500, detail=f"Upload failed: {exc}")


@router.get("/files", response_model=MegaFileListResponse)
async def list_mega_files(user: dict = Depends(get_current_user)):
    """List files inside the user's dedicated MEGA DocMatrix folder."""
    started_at = time.perf_counter()
    try:
        files = await run_in_threadpool(mega_service.list_files, user["id"])
        items = [MegaFileItem(**{k: v for k, v in file_entry.items() if k in {"file_id", "name", "size_bytes", "uploaded_at"}}) for file_entry in files]
        _log_mega_timing("list", started_at, user["id"], True)
        return MegaFileListResponse(success=True, files=items, count=len(items))
    except ValueError as exc:
        _log_mega_timing("list", started_at, user["id"], False, str(exc))
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        _log_mega_timing("list", started_at, user["id"], False, str(exc))
        raise HTTPException(status_code=500, detail=f"Could not list files: {exc}")


@router.get("/download/{file_id}")
async def download_mega_file(file_id: str, user: dict = Depends(get_current_user)):
    """Download a file from the user's dedicated MEGA DocMatrix folder."""
    started_at = time.perf_counter()
    try:
        path, filename = await run_in_threadpool(mega_service.download_file, user["id"], file_id)
        _log_mega_timing("download", started_at, user["id"], True)
        return FileResponse(
            path=path,
            media_type="application/octet-stream",
            filename=filename,
            background=BackgroundTask(_cleanup_temp_file, path),
        )
    except ValueError as exc:
        _log_mega_timing("download", started_at, user["id"], False, str(exc))
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        _log_mega_timing("download", started_at, user["id"], False, str(exc))
        raise HTTPException(status_code=500, detail=f"Download failed: {exc}")


@router.delete("/file/{file_id}", response_model=MegaActionResponse)
async def delete_mega_file(file_id: str, user: dict = Depends(get_current_user)):
    """Delete a file from the user's dedicated MEGA DocMatrix folder."""
    started_at = time.perf_counter()
    try:
        await run_in_threadpool(mega_service.delete_file, user["id"], file_id)
        _log_mega_timing("delete", started_at, user["id"], True)
        return MegaActionResponse(success=True, message="File deleted from MEGA successfully")
    except ValueError as exc:
        _log_mega_timing("delete", started_at, user["id"], False, str(exc))
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        _log_mega_timing("delete", started_at, user["id"], False, str(exc))
        raise HTTPException(status_code=500, detail=f"Delete failed: {exc}")
