"""
Universal Document Encryption Service for DocMatrix DMS.
Supports:
- Word (.docx): Native Office OOXML password encryption (msoffcrypto)
- Excel (.xlsx) / PPT (.pptx): Native Office OOXML encryption (msoffcrypto)
- PDF (.pdf): Native PDF password encryption (pypdf)
- Image / Text / CSV / Other: AES-256-GCM encryption with PBKDF2 salt
"""

import io
import os
import hashlib
import logging
from typing import Tuple, Optional
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from .docx_security import encrypt_docx_bytes, decrypt_docx_bytes, is_docx_encrypted

logger = logging.getLogger(__name__)

HEADER_PREFIX = b"DOCMATRIX_ENC_V1:"
SALT_SIZE = 16
NONCE_SIZE = 12
PBKDF2_ITERATIONS = 100_000


def hash_password(password: str) -> str:
    """Generate SHA-256 hash for password verification."""
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def verify_password(password: str, expected_hash: str) -> bool:
    """Verify password against stored SHA-256 hash."""
    if not password or not expected_hash:
        return False
    return hash_password(password).lower() == expected_hash.lower()


def _derive_key(password: str, salt: bytes) -> bytes:
    """Derive 256-bit key from password using PBKDF2 HMAC SHA-256."""
    return hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        PBKDF2_ITERATIONS,
        dklen=32
    )


def encrypt_aes_bytes(content: bytes, password: str) -> bytes:
    """Encrypt raw file bytes with AES-256-GCM."""
    salt = os.urandom(SALT_SIZE)
    key = _derive_key(password, salt)
    aesgcm = AESGCM(key)
    nonce = os.urandom(NONCE_SIZE)
    ciphertext = aesgcm.encrypt(nonce, content, None)
    return HEADER_PREFIX + salt + nonce + ciphertext


def decrypt_aes_bytes(encrypted_data: bytes, password: str) -> bytes:
    """Decrypt AES-256-GCM encrypted file bytes."""
    if not encrypted_data.startswith(HEADER_PREFIX):
        raise ValueError("Invalid encrypted document format")
    
    payload = encrypted_data[len(HEADER_PREFIX):]
    if len(payload) < SALT_SIZE + NONCE_SIZE + 16:
        raise ValueError("Corrupted encrypted payload")

    salt = payload[:SALT_SIZE]
    nonce = payload[SALT_SIZE:SALT_SIZE + NONCE_SIZE]
    ciphertext = payload[SALT_SIZE + NONCE_SIZE:]

    key = _derive_key(password, salt)
    aesgcm = AESGCM(key)
    try:
        return aesgcm.decrypt(nonce, ciphertext, None)
    except Exception as exc:
        raise ValueError("Incorrect password or corrupted file") from exc


def encrypt_pdf_bytes(pdf_bytes: bytes, password: str) -> bytes:
    """Encrypt PDF using pypdf."""
    import pypdf
    reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
    writer = pypdf.PdfWriter()
    for page in reader.pages:
        writer.add_page(page)
    writer.encrypt(user_password=password, owner_password=password)
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


def decrypt_pdf_bytes(pdf_bytes: bytes, password: str) -> bytes:
    """Decrypt PDF using pypdf."""
    import pypdf
    reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
    if reader.is_encrypted:
        try:
            reader.decrypt(password)
        except Exception:
            raise ValueError("Incorrect PDF password")
    writer = pypdf.PdfWriter()
    for page in reader.pages:
        writer.add_page(page)
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


def encrypt_document_bytes(content: bytes, password: str, filename: str = "", mime_type: str = "") -> Tuple[bytes, str]:
    """
    Encrypt document bytes based on file format.
    Returns (encrypted_bytes, encryption_type).
    """
    if not content:
        raise ValueError("Document content is empty")
    if not password:
        raise ValueError("Password is required")

    fn = (filename or "").lower()
    mt = (mime_type or "").lower()

    # 1. Word DOCX / Office files (.docx, .xlsx, .pptx)
    if fn.endswith((".docx", ".xlsx", ".pptx", ".doc")) or "wordprocessingml" in mt or "spreadsheetml" in mt or "presentationml" in mt:
        try:
            encrypted = encrypt_docx_bytes(content, password)
            return encrypted, "native_docx"
        except Exception as err:
            logger.warning(f"Native OOXML encryption failed, fallback to AES: {err}")

    # 2. PDF files (.pdf)
    if fn.endswith(".pdf") or "pdf" in mt:
        try:
            encrypted = encrypt_pdf_bytes(content, password)
            return encrypted, "native_pdf"
        except Exception as err:
            logger.warning(f"Native PDF encryption failed, fallback to AES: {err}")

    # 3. Fallback / Universal AES-256 encryption for Images, Text, CSV, etc.
    encrypted = encrypt_aes_bytes(content, password)
    return encrypted, "aes"


def decrypt_document_bytes(content: bytes, password: str, filename: str = "", mime_type: str = "", encryption_type: str = None) -> bytes:
    """
    Decrypt document bytes based on content header or encryption_type.
    """
    if not content:
        raise ValueError("Document content is empty")
    if not password:
        raise ValueError("Password is required")

    if content.startswith(HEADER_PREFIX) or encryption_type == "aes":
        return decrypt_aes_bytes(content, password)

    fn = (filename or "").lower()
    mt = (mime_type or "").lower()

    if encryption_type == "native_docx" or fn.endswith((".docx", ".xlsx", ".pptx", ".doc")) or is_docx_encrypted(content):
        try:
            return decrypt_docx_bytes(content, password)
        except Exception as err:
            logger.debug(f"DOCX decrypt error: {err}")

    if encryption_type == "native_pdf" or fn.endswith(".pdf") or "pdf" in mt:
        try:
            return decrypt_pdf_bytes(content, password)
        except Exception as err:
            logger.debug(f"PDF decrypt error: {err}")

    if content.startswith(HEADER_PREFIX):
        return decrypt_aes_bytes(content, password)

    raise ValueError("Failed to decrypt document. Verify your password.")
