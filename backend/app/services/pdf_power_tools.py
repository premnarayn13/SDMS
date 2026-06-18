"""
PDF Power Tools Executor Service
Advanced PDF manipulation for AI Agent execution
Handles form filling, signatures, watermarks, page operations, etc.
"""
import logging
import io
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
import base64

# PDF processing
try:
    import pypdf
except ImportError:
    pypdf = None

try:
    from pdf2image import convert_from_bytes
except ImportError:
    convert_from_bytes = None

try:
    from PIL import Image, ImageDraw
except ImportError:
    Image = ImageDraw = None

try:
    import pdfplumber
except ImportError:
    pdfplumber = None

logger = logging.getLogger(__name__)


class PDFPowerToolsExecutor:
    """Execute PDF power tool operations for AI Agent"""
    
    def __init__(self):
        self.temp_storage = {}
    
    # ============================================
    # 1. TEXT EXTRACTION
    # ============================================
    
    async def extract_text(self, pdf_bytes: bytes) -> Tuple[Optional[str], Optional[str]]:
        """Extract all text from PDF"""
        try:
            if not pdfplumber:
                return None, "pdfplumber not installed"
            
            with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                extracted_text = []
                for page_num, page in enumerate(pdf.pages, 1):
                    text = page.extract_text() or ""
                    if text.strip():
                        extracted_text.append(f"--- Page {page_num} ---\n{text}")
                
                result = "\n\n".join(extracted_text) if extracted_text else ""
                return result, None
        except Exception as e:
            logger.error(f"Text extraction failed: {e}")
            return None, str(e)
    
    # ============================================
    # 2. PDF TO IMAGES
    # ============================================
    
    async def pdf_to_images(self, pdf_bytes: bytes) -> Tuple[Optional[List[bytes]], Optional[str]]:
        """Convert PDF pages to images"""
        try:
            if not convert_from_bytes:
                return None, "pdf2image not installed"
            
            images = convert_from_bytes(pdf_bytes, fmt='png')
            image_bytes_list = []
            
            for img in images:
                img_byte_arr = io.BytesIO()
                img.save(img_byte_arr, format='PNG')
                image_bytes_list.append(img_byte_arr.getvalue())
            
            return image_bytes_list, None
        except Exception as e:
            logger.error(f"PDF to images conversion failed: {e}")
            return None, str(e)
    
    # ============================================
    # 3. IMAGES TO PDF
    # ============================================
    
    async def images_to_pdf(self, image_bytes_list: List[bytes]) -> Tuple[Optional[bytes], Optional[str]]:
        """Combine images into PDF"""
        try:
            if not Image:
                return None, "Pillow not installed"
            
            images = []
            for img_bytes in image_bytes_list:
                img = Image.open(io.BytesIO(img_bytes))
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                images.append(img)
            
            if not images:
                return None, "No valid images provided"
            
            # Convert to PDF
            first = images[0]
            rest = images[1:] if len(images) > 1 else []
            
            pdf_bytes = io.BytesIO()
            first.save(pdf_bytes, format='PDF', save_all=True, append_images=rest)
            
            return pdf_bytes.getvalue(), None
        except Exception as e:
            logger.error(f"Images to PDF conversion failed: {e}")
            return None, str(e)
    
    # ============================================
    # 4. MERGE PDFS
    # ============================================
    
    async def merge_pdfs(self, pdf_bytes_list: List[bytes]) -> Tuple[Optional[bytes], Optional[str]]:
        """Merge multiple PDFs into one"""
        try:
            if not pypdf:
                return None, "pypdf not installed"
            
            merger = pypdf.PdfMerger()
            
            for pdf_bytes in pdf_bytes_list:
                merger.append(io.BytesIO(pdf_bytes))
            
            output = io.BytesIO()
            merger.write(output)
            merger.close()
            
            return output.getvalue(), None
        except Exception as e:
            logger.error(f"PDF merge failed: {e}")
            return None, str(e)
    
    # ============================================
    # 5. SPLIT PDF BY PAGE RANGE
    # ============================================
    
    async def split_pdf_range(self, pdf_bytes: bytes, start_page: int, end_page: int) -> Tuple[Optional[bytes], Optional[str]]:
        """Extract specific page range from PDF"""
        try:
            if not pypdf:
                return None, "pypdf not installed"
            
            reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
            writer = pypdf.PdfWriter()
            
            total_pages = len(reader.pages)
            if start_page < 0 or end_page > total_pages or start_page >= end_page:
                return None, f"Invalid page range: {start_page}-{end_page} (total: {total_pages})"
            
            for page_num in range(start_page, end_page):
                writer.add_page(reader.pages[page_num])
            
            output = io.BytesIO()
            writer.write(output)
            
            return output.getvalue(), None
        except Exception as e:
            logger.error(f"PDF split failed: {e}")
            return None, str(e)
    
    # ============================================
    # 6. SPLIT PDF TO SINGLE PAGES
    # ============================================
    
    async def split_pdf_pages(self, pdf_bytes: bytes) -> Tuple[Optional[List[bytes]], Optional[str]]:
        """Split PDF into individual page files"""
        try:
            if not pypdf:
                return None, "pypdf not installed"
            
            reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
            page_files = []
            
            for page_num in range(len(reader.pages)):
                writer = pypdf.PdfWriter()
                writer.add_page(reader.pages[page_num])
                
                output = io.BytesIO()
                writer.write(output)
                page_files.append(output.getvalue())
            
            return page_files, None
        except Exception as e:
            logger.error(f"PDF page split failed: {e}")
            return None, str(e)
    
    # ============================================
    # 7. COMPRESS PDF
    # ============================================
    
    async def compress_pdf(self, pdf_bytes: bytes) -> Tuple[Optional[bytes], Optional[str]]:
        """Reduce PDF file size"""
        try:
            if not pypdf:
                return None, "pypdf not installed"
            
            reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
            writer = pypdf.PdfWriter()
            
            for page_num in range(len(reader.pages)):
                page = reader.pages[page_num]
                page.compress_content_streams()
                writer.add_page(page)
            
            output = io.BytesIO()
            writer.write(output)
            
            return output.getvalue(), None
        except Exception as e:
            logger.error(f"PDF compression failed: {e}")
            return None, str(e)
    
    # ============================================
    # 8. ROTATE PAGES
    # ============================================
    
    async def rotate_pages(self, pdf_bytes: bytes, page_numbers: List[int], rotation_degrees: int) -> Tuple[Optional[bytes], Optional[str]]:
        """Rotate specific pages"""
        try:
            if not pypdf:
                return None, "pypdf not installed"
            
            reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
            writer = pypdf.PdfWriter()
            
            # Normalize rotation to 0, 90, 180, 270
            rotation = rotation_degrees % 360
            if rotation not in [0, 90, 180, 270]:
                return None, f"Rotation must be 0, 90, 180, or 270 degrees"
            
            for page_num in range(len(reader.pages)):
                page = reader.pages[page_num]
                if page_num in page_numbers:
                    page.rotate(rotation)
                writer.add_page(page)
            
            output = io.BytesIO()
            writer.write(output)
            
            return output.getvalue(), None
        except Exception as e:
            logger.error(f"PDF rotation failed: {e}")
            return None, str(e)
    
    # ============================================
    # 9. REMOVE PAGES
    # ============================================
    
    async def remove_pages(self, pdf_bytes: bytes, page_numbers: List[int]) -> Tuple[Optional[bytes], Optional[str]]:
        """Remove specific pages from PDF"""
        try:
            if not pypdf:
                return None, "pypdf not installed"
            
            reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
            writer = pypdf.PdfWriter()
            
            # Sort in descending order to avoid index shift issues
            pages_to_remove = sorted(set(page_numbers), reverse=True)
            
            for page_num in range(len(reader.pages)):
                if page_num not in pages_to_remove:
                    writer.add_page(reader.pages[page_num])
            
            if len(writer.pages) == 0:
                return None, "All pages would be removed"
            
            output = io.BytesIO()
            writer.write(output)
            
            return output.getvalue(), None
        except Exception as e:
            logger.error(f"PDF page removal failed: {e}")
            return None, str(e)
    
    # ============================================
    # 10. REORDER PAGES
    # ============================================
    
    async def reorder_pages(self, pdf_bytes: bytes, page_order: List[int]) -> Tuple[Optional[bytes], Optional[str]]:
        """Reorder PDF pages"""
        try:
            if not pypdf:
                return None, "pypdf not installed"
            
            reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
            writer = pypdf.PdfWriter()
            
            total_pages = len(reader.pages)
            if len(page_order) != total_pages:
                return None, f"Page order length {len(page_order)} doesn't match total pages {total_pages}"
            
            if set(page_order) != set(range(total_pages)):
                return None, "Page order must contain all pages exactly once"
            
            for page_num in page_order:
                writer.add_page(reader.pages[page_num])
            
            output = io.BytesIO()
            writer.write(output)
            
            return output.getvalue(), None
        except Exception as e:
            logger.error(f"PDF reorder failed: {e}")
            return None, str(e)
    
    # ============================================
    # 11. ADD WATERMARK
    # ============================================
    
    async def add_watermark(self, pdf_bytes: bytes, watermark_text: str, opacity: float = 0.3) -> Tuple[Optional[bytes], Optional[str]]:
        """Add text watermark to all pages"""
        try:
            if not pypdf:
                return None, "pypdf not installed"
            
            reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
            writer = pypdf.PdfWriter()
            
            # Create watermark packet
            from reportlab.pdfgen import canvas
            from reportlab.lib.pagesizes import letter
            
            watermark_buffer = io.BytesIO()
            c = canvas.Canvas(watermark_buffer, pagesize=letter)
            c.setFillOpacity(opacity)
            c.setFont("Helvetica", 60)
            c.rotate(45)
            c.drawString(100, 100, watermark_text)
            c.save()
            watermark_buffer.seek(0)
            
            watermark_reader = pypdf.PdfReader(watermark_buffer)
            watermark_page = watermark_reader.pages[0]
            
            for page_num in range(len(reader.pages)):
                page = reader.pages[page_num]
                page.merge_page(watermark_page)
                writer.add_page(page)
            
            output = io.BytesIO()
            writer.write(output)
            
            return output.getvalue(), None
        except Exception as e:
            logger.error(f"Watermark addition failed: {e}")
            return None, str(e)
    
    # ============================================
    # 12. DUPLICATE PAGES
    # ============================================
    
    async def duplicate_pages(self, pdf_bytes: bytes, page_numbers: List[int], copies: int = 1) -> Tuple[Optional[bytes], Optional[str]]:
        """Duplicate specific pages"""
        try:
            if not pypdf:
                return None, "pypdf not installed"
            
            reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
            writer = pypdf.PdfWriter()
            
            for page_num in range(len(reader.pages)):
                writer.add_page(reader.pages[page_num])
                if page_num in page_numbers:
                    for _ in range(copies):
                        writer.add_page(reader.pages[page_num])
            
            output = io.BytesIO()
            writer.write(output)
            
            return output.getvalue(), None
        except Exception as e:
            logger.error(f"Page duplication failed: {e}")
            return None, str(e)
    
    # ============================================
    # 13. PASSWORD PROTECT
    # ============================================
    
    async def password_protect(self, pdf_bytes: bytes, password: str) -> Tuple[Optional[bytes], Optional[str]]:
        """Add password protection to PDF"""
        try:
            if not pypdf:
                return None, "pypdf not installed"
            
            reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
            writer = pypdf.PdfWriter()
            
            for page_num in range(len(reader.pages)):
                writer.add_page(reader.pages[page_num])
            
            writer.encrypt(user_password=password, owner_password=password)
            
            output = io.BytesIO()
            writer.write(output)
            
            return output.getvalue(), None
        except Exception as e:
            logger.error(f"Password protection failed: {e}")
            return None, str(e)
    
    # ============================================
    # 14. FORM FILLING (Placeholder)
    # ============================================
    
    async def fill_form(self, pdf_bytes: bytes, form_data: Dict[str, Any]) -> Tuple[Optional[bytes], Optional[str]]:
        """Fill PDF form fields"""
        try:
            # This requires pdf-lib or similar
            # For now, return placeholder response
            logger.warning("Form filling requires frontend implementation with pdf-lib")
            return None, "Form filling requires frontend-side processing with pdf-lib"
        except Exception as e:
            logger.error(f"Form filling failed: {e}")
            return None, str(e)
    
    # ============================================
    # 15. ADD SIGNATURE (Placeholder)
    # ============================================
    
    async def add_signature(self, pdf_bytes: bytes, signature_image: bytes, page: int, x: float, y: float, width: float, height: float) -> Tuple[Optional[bytes], Optional[str]]:
        """Add signature image to PDF"""
        try:
            if not Image or not pypdf:
                return None, "PIL or pypdf not installed"
            
            reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
            writer = pypdf.PdfWriter()
            
            # Load signature image
            sig_img = Image.open(io.BytesIO(signature_image))
            
            for page_num in range(len(reader.pages)):
                page_obj = reader.pages[page_num]
                writer.add_page(page_obj)
            
            # Note: Direct image embedding requires additional implementation
            logger.warning("Signature addition requires frontend pdf-lib implementation")
            return None, "Signature addition requires frontend-side processing"
        except Exception as e:
            logger.error(f"Signature addition failed: {e}")
            return None, str(e)


# Singleton instance
_executor_instance = None


def get_pdf_executor() -> PDFPowerToolsExecutor:
    """Get PDF Power Tools executor instance"""
    global _executor_instance
    if _executor_instance is None:
        _executor_instance = PDFPowerToolsExecutor()
    return _executor_instance
