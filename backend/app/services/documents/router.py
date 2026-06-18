"""
Documents API Router
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import StreamingResponse, Response
from typing import Optional, List

from ...middleware.auth import get_current_user, get_verified_user
from .schemas import (
    DocumentCreate, DocumentUpdate, DocumentResponse, DocumentListResponse,
    UploadResponse, MoveDocumentRequest, ShareDocumentRequest, ShareResponse,
    VersionResponse, DeleteConfirmRequest
)
from .service import documents_service
from ..drive.service import drive_service
from ...utils.docx_security import encrypt_docx_bytes, decrypt_docx_bytes, is_docx_encrypted

router = APIRouter(prefix="/documents", tags=["Documents"])


def _normalize_docx_filename(filename: Optional[str], fallback: str = "document.docx") -> str:
    name = (filename or fallback).strip() or fallback
    if name.lower().endswith(".docx"):
        return name
    if name.lower().endswith(".doc"):
        return f"{name[:-4]}.docx"
    return f"{name}.docx"


def _is_drive_auth_error(message: str) -> bool:
    text = (message or "").lower()
    markers = (
        "invalid_grant",
        "invalid credentials",
        "unauthorized",
        "token",
        "credential",
        "auth"
    )
    return any(marker in text for marker in markers)


async def _build_reauthorize_hint(user_id: str, message: str) -> dict:
    detail = {
        "message": message,
        "code": "drive_reauthorize_required",
        "reauthorize_required": True,
    }
    try:
        detail["reauthorize_url"] = await drive_service.reauthorize_drive(user_id)
    except Exception:
        detail["reauthorize_url"] = None
    return detail


@router.post("/upload", response_model=UploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    folder_id: Optional[str] = Form(None),
    drive_id: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),  # Comma-separated
    user: dict = Depends(get_verified_user)
):
    """Upload a document to Google Drive"""
    try:
        content = await file.read()
        
        tag_list = []
        if tags:
            tag_list = [t.strip() for t in tags.split(",") if t.strip()]
        
        document = await documents_service.upload_file(
            user_id=user["id"],
            file_content=content,
            filename=file.filename,
            mime_type=file.content_type or "application/octet-stream",
            drive_id=drive_id,
            virtual_folder_id=folder_id,
            description=description,
            tags=tag_list
        )
        
        return UploadResponse(
            document=DocumentResponse(**document),
            message="File uploaded successfully"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    view: str = Query("home", description="View: home, all, favorites, trash, recent, folder"),
    folder_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    file_type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    user: dict = Depends(get_current_user)
):
    """List documents with filters"""
    try:
        documents, total = await documents_service.get_documents(
            user_id=user["id"],
            view=view,
            folder_id=folder_id,
            search=search,
            tag=tag,
            file_type=file_type,
            page=page,
            page_size=page_size
        )
        
        return DocumentListResponse(
            documents=[DocumentResponse(**doc) for doc in documents],
            total=total,
            page=page,
            page_size=page_size
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: str,
    user: dict = Depends(get_current_user)
):
    """Get document details"""
    try:
        document = await documents_service.get_document(user["id"], document_id)
        return DocumentResponse(**document)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{document_id}/download")
async def download_document(
    document_id: str,
    user: dict = Depends(get_current_user)
):
    """Download document content"""
    try:
        try:
            stream, filename, mime_type = await documents_service.download_document_stream(
                user["id"], document_id
            )

            return StreamingResponse(
                stream,
                media_type=mime_type,
                headers={
                    "Content-Disposition": f'attachment; filename="{filename}"'
                }
            )
        except Exception:
            # Fallback for providers/files where streaming can fail unexpectedly.
            content, filename, mime_type = await documents_service.download_document(
                user["id"], document_id
            )
            return Response(
                content=content,
                media_type=mime_type,
                headers={
                    "Content-Disposition": f'attachment; filename="{filename}"'
                }
            )
    except ValueError as e:
        message = str(e)
        if _is_drive_auth_error(message):
            detail = await _build_reauthorize_hint(user["id"], message)
            raise HTTPException(status_code=401, detail=detail)
        raise HTTPException(status_code=404, detail=message)
    except Exception as e:
        message = str(e)
        if _is_drive_auth_error(message):
            detail = await _build_reauthorize_hint(user["id"], message)
            raise HTTPException(status_code=401, detail=detail)
        raise HTTPException(status_code=500, detail=message)


@router.get("/{document_id}/view-url")
async def get_view_url(
    document_id: str,
    user: dict = Depends(get_current_user)
):
    """Get document view/download URL"""
    try:
        url = await documents_service.get_download_url(user["id"], document_id)
        return {"url": url}
    except ValueError as e:
        message = str(e)
        if _is_drive_auth_error(message):
            detail = await _build_reauthorize_hint(user["id"], message)
            raise HTTPException(status_code=401, detail=detail)
        raise HTTPException(status_code=404, detail=message)


@router.patch("/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: str,
    updates: DocumentUpdate,
    user: dict = Depends(get_current_user)
):
    """Update document metadata"""
    try:
        document = await documents_service.update_document(
            user["id"],
            document_id,
            updates.model_dump(exclude_unset=True)
        )
        return DocumentResponse(**document)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{document_id}/favorite", response_model=DocumentResponse)
async def toggle_favorite(
    document_id: str,
    user: dict = Depends(get_current_user)
):
    """Toggle document favorite status"""
    try:
        document = await documents_service.toggle_favorite(user["id"], document_id)
        return DocumentResponse(**document)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{document_id}/move", response_model=DocumentResponse)
async def move_document(
    document_id: str,
    request: MoveDocumentRequest,
    user: dict = Depends(get_current_user)
):
    """Move document to folder"""
    try:
        document = await documents_service.move_document(
            user["id"],
            document_id,
            request.target_folder_id
        )
        return DocumentResponse(**document)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{document_id}/duplicate", response_model=DocumentResponse)
async def duplicate_document(
    document_id: str,
    user: dict = Depends(get_current_user)
):
    """Duplicate a document"""
    try:
        document = await documents_service.duplicate_document(user["id"], document_id)
        return DocumentResponse(**document)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{document_id}/request-delete-otp")
async def request_delete_otp(
    document_id: str,
    user: dict = Depends(get_verified_user)
):
    """Request OTP for permanent deletion"""
    try:
        await documents_service.request_delete_otp(user["id"], document_id)
        return {"message": "OTP sent to your email"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    permanent: bool = Query(False),
    otp: Optional[str] = Query(None),
    user: dict = Depends(get_current_user)
):
    """Delete document (soft delete or permanent with OTP)"""
    try:
        await documents_service.delete_document(
            user["id"],
            document_id,
            permanent=permanent,
            otp=otp
        )
        
        message = "Document permanently deleted" if permanent else "Document moved to trash"
        return {"message": message}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{document_id}/restore", response_model=DocumentResponse)
async def restore_document(
    document_id: str,
    user: dict = Depends(get_current_user)
):
    """Restore document from trash"""
    try:
        document = await documents_service.restore_document(user["id"], document_id)
        return DocumentResponse(**document)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# Version endpoints
@router.post("/{document_id}/versions", response_model=VersionResponse)
async def upload_version(
    document_id: str,
    file: UploadFile = File(...),
    change_description: Optional[str] = Form(None),
    user: dict = Depends(get_current_user)
):
    """Upload a new version for an existing document (updates the same Drive file)."""
    try:
        content = await file.read()
        version = await documents_service.upload_version(
            user_id=user["id"],
            document_id=document_id,
            file_content=content,
            mime_type=file.content_type or "application/octet-stream",
            change_description=change_description
        )
        return VersionResponse(**version)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload version failed: {str(e)}")


@router.get("/{document_id}/versions", response_model=List[VersionResponse])
async def get_versions(
    document_id: str,
    user: dict = Depends(get_current_user)
):
    """Get document version history"""
    try:
        versions = await documents_service.get_versions(user["id"], document_id)
        return [VersionResponse(**v) for v in versions]
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# Share endpoints
@router.post("/{document_id}/share", response_model=ShareResponse)
async def share_document(
    document_id: str,
    request: ShareDocumentRequest,
    user: dict = Depends(get_verified_user)
):
    """Share document with another user"""
    try:
        share = await documents_service.add_share(
            user["id"],
            document_id,
            request.email,
            request.permission
        )
        return ShareResponse(**share)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{document_id}/share/{email}")
async def remove_share(
    document_id: str,
    email: str,
    user: dict = Depends(get_current_user)
):
    """Remove share from document"""
    try:
        await documents_service.remove_share(user["id"], document_id, email)
        return {"message": "Share removed"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{document_id}/shares", response_model=List[ShareResponse])
async def get_shares(
    document_id: str,
    user: dict = Depends(get_current_user)
):
    """Get document shares"""
    try:
        shares = await documents_service.get_shares(user["id"], document_id)
        return [ShareResponse(**s) for s in shares]
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/{document_id}/share-link")
async def create_public_share_link(
    document_id: str,
    user: dict = Depends(get_current_user)
):
    """
    Generate public share link
    """

    try:
        result = await documents_service.generate_public_link(
            user["id"],
            document_id
        )

        return {
            "url": f"http://localhost:3000/share/{result['token']}",
            "token": result["token"]
        }

    except ValueError as e:
        raise HTTPException(
            status_code=404,
            detail=str(e)
        )
    
@router.get("/public/{token}")
async def get_public_document(
    token: str
):
    """
    Public document access
    """

    try:
        document = await documents_service.get_public_document(
            token
        )

        return document

    except ValueError as e:
        raise HTTPException(
            status_code=404,
            detail=str(e)
        )
    
    

@router.post("/tools/docx/encrypt")
async def encrypt_docx_file(
    file: UploadFile = File(...),
    password: str = Form(...),
    user: dict = Depends(get_current_user)
):
    """Encrypt a DOCX with Office-compatible password protection."""
    del user  # authenticated endpoint, user object not needed for operation

    try:
        content = await file.read()
        encrypted = encrypt_docx_bytes(content, password)
        output_name = _normalize_docx_filename(file.filename)

        return StreamingResponse(
            iter([encrypted]),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="encrypted_{output_name}"'},
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"DOCX encryption failed: {exc}") from exc


@router.post("/tools/docx/decrypt")
async def decrypt_docx_file(
    file: UploadFile = File(...),
    password: str = Form(...),
    user: dict = Depends(get_current_user)
):
    """Decrypt an encrypted DOCX file using its password."""
    del user

    try:
        content = await file.read()
        encrypted_flag = is_docx_encrypted(content)
        if encrypted_flag is False:
            raise HTTPException(status_code=400, detail="This DOCX is not encrypted")

        decrypted = decrypt_docx_bytes(content, password)
        output_name = _normalize_docx_filename(file.filename)

        return StreamingResponse(
            iter([decrypted]),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="decrypted_{output_name}"'},
        )
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"DOCX decryption failed: {exc}") from exc


# Tag endpoints
@router.post("/{document_id}/tags/{tag}", response_model=DocumentResponse)
async def add_tag(
    document_id: str,
    tag: str,
    user: dict = Depends(get_current_user)
):
    """Add tag to document"""
    try:
        document = await documents_service.add_tag(user["id"], document_id, tag)
        return DocumentResponse(**document)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{document_id}/tags/{tag}", response_model=DocumentResponse)
async def remove_tag(
    document_id: str,
    tag: str,
    user: dict = Depends(get_current_user)
):
    """Remove tag from document"""
    try:
        document = await documents_service.remove_tag(user["id"], document_id, tag)
        return DocumentResponse(**document)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
