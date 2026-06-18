"""DOCX encryption/decryption helpers using OOXML-compatible crypto tools."""

from __future__ import annotations

from io import BytesIO
from typing import Optional


def _require_msoffcrypto():
    try:
        import msoffcrypto  # type: ignore
        from msoffcrypto.format.ooxml import OOXMLFile  # type: ignore
        return msoffcrypto, OOXMLFile
    except Exception as exc:  # pragma: no cover - dependency guard
        raise RuntimeError(
            "DOCX crypto engine is unavailable. Install msoffcrypto-tool>=5.2.0 in backend."
        ) from exc


def encrypt_docx_bytes(data: bytes, password: str) -> bytes:
    if not data:
        raise ValueError("Input DOCX is empty")
    if not password:
        raise ValueError("Password is required")

    _, ooxml_cls = _require_msoffcrypto()

    source = BytesIO(data)
    target = BytesIO()
    ooxml = ooxml_cls(source)

    # Compatibility across msoffcrypto-tool versions.
    attempted = []
    for args in ((password, target), (target, password), (password,),):
        try:
            result = ooxml.encrypt(*args)
            if isinstance(result, bytes):
                target.write(result)
            elif hasattr(result, "getvalue"):
                target = result
            break
        except TypeError as exc:
            attempted.append(str(exc))
            continue
        except Exception as exc:
            raise ValueError(f"Failed to encrypt DOCX: {exc}") from exc
    else:
        raise RuntimeError(
            "Unsupported msoffcrypto-tool encrypt() signature encountered: "
            + " | ".join(attempted)
        )

    encrypted = target.getvalue()
    if not encrypted:
        raise ValueError("DOCX encryption returned empty output")
    return encrypted


def decrypt_docx_bytes(data: bytes, password: str) -> bytes:
    if not data:
        raise ValueError("Input DOCX is empty")
    if not password:
        raise ValueError("Password is required")

    msoffcrypto, _ = _require_msoffcrypto()

    source = BytesIO(data)
    target = BytesIO()

    try:
        office_file = msoffcrypto.OfficeFile(source)
        office_file.load_key(password=password)
        office_file.decrypt(target)
    except Exception as exc:
        raise ValueError(f"Failed to decrypt DOCX: {exc}") from exc

    decrypted = target.getvalue()
    if not decrypted:
        raise ValueError("DOCX decryption returned empty output")
    return decrypted


def is_docx_encrypted(data: bytes) -> Optional[bool]:
    if not data:
        return None

    try:
        msoffcrypto, _ = _require_msoffcrypto()
    except RuntimeError:
        return None

    try:
        office_file = msoffcrypto.OfficeFile(BytesIO(data))
        return bool(getattr(office_file, "is_encrypted", lambda: False)())
    except Exception:
        return None
