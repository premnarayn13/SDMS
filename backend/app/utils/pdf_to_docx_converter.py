"""
PDF to Word Document Converter
Convert PDF files to .docx format using pdf2docx library
"""
from pdf2docx import Converter
import os
import logging
from typing import Optional, List
from pathlib import Path

logger = logging.getLogger(__name__)


class PDFtoDocxConverter:
    """Convert PDF files to Word documents (.docx)"""
    
    def __init__(self):
        """Initialize converter"""
        self.converter = None
    
    def convert_pdf(
        self,
        pdf_path: str,
        output_path: Optional[str] = None,
        start_page: int = 0,
        end_page: Optional[int] = None
    ) -> bool:
        """
        Convert a PDF file to Word document
        
        Args:
            pdf_path: Full path to input PDF file
            output_path: Full path for output .docx file (optional)
                        If not provided, uses same name as PDF with .docx extension
            start_page: Starting page number (0-indexed, default: 0 = first page)
            end_page: Ending page number (inclusive, optional)
                     If None, converts all pages
        
        Returns:
            True if conversion successful, False otherwise
        
        Example:
            converter = PDFtoDocxConverter()
            success = converter.convert_pdf(
                pdf_path="document.pdf",
                output_path="document.docx"
            )
        """
        cv = None
        try:
            # Verify input file exists
            if not os.path.exists(pdf_path):
                logger.error(f"PDF file not found: {pdf_path}")
                return False
            
            # Determine output path
            if output_path is None:
                base_name = os.path.splitext(pdf_path)[0]
                output_path = f"{base_name}.docx"
            
            # Ensure output directory exists
            output_dir = os.path.dirname(output_path)
            if output_dir and not os.path.exists(output_dir):
                os.makedirs(output_dir, exist_ok=True)
            
            logger.info(f"Converting PDF: {pdf_path}")
            logger.info(f"Output: {output_path}")
            
            # Convert PDF to DOCX
            cv = Converter(pdf_path)
            
            if end_page is None:
                # Convert all pages
                cv.convert(output_path)
            else:
                # Convert specific range
                cv.convert(output_path, start=start_page, end=end_page)
            
            cv.close()
            cv = None
            
            # Verify output file was created
            if os.path.exists(output_path):
                file_size = os.path.getsize(output_path)
                logger.info(f"✓ Conversion successful! Output size: {file_size} bytes")
                return True
            else:
                logger.error("Conversion failed - output file not created")
                return False
                
        except Exception as e:
            logger.error(f"Error during PDF conversion: {e}")
            return False
        finally:
            if cv is not None:
                try:
                    cv.close()
                except Exception:
                    pass
    
    def batch_convert(
        self,
        pdf_folder: str,
        output_folder: Optional[str] = None,
        pattern: str = "*.pdf"
    ) -> List[dict]:
        """
        Convert multiple PDF files from a folder
        
        Args:
            pdf_folder: Folder containing PDF files
            output_folder: Output folder for DOCX files (optional)
                          If not provided, outputs to same folder
            pattern: File pattern to match (default: "*.pdf")
        
        Returns:
            List of conversion results with format:
            [
                {
                    "pdf_file": "filename.pdf",
                    "docx_file": "filename.docx",
                    "success": True/False,
                    "error": "error message if failed"
                },
                ...
            ]
        
        Example:
            converter = PDFtoDocxConverter()
            results = converter.batch_convert(
                pdf_folder="./pdfs",
                output_folder="./docx_output"
            )
        """
        results = []
        
        try:
            # Ensure input folder exists
            if not os.path.exists(pdf_folder):
                logger.error(f"PDF folder not found: {pdf_folder}")
                return results
            
            # Ensure output folder exists
            if output_folder is None:
                output_folder = pdf_folder
            
            os.makedirs(output_folder, exist_ok=True)
            
            # Find all PDF files
            pdf_files = list(Path(pdf_folder).glob(pattern))
            logger.info(f"Found {len(pdf_files)} PDF files in {pdf_folder}")
            
            for i, pdf_file in enumerate(pdf_files, 1):
                pdf_filename = pdf_file.name
                docx_filename = pdf_file.stem + ".docx"
                output_path = os.path.join(output_folder, docx_filename)
                
                logger.info(f"[{i}/{len(pdf_files)}] Converting {pdf_filename}...")
                
                try:
                    success = self.convert_pdf(str(pdf_file), output_path)
                    
                    results.append({
                        "pdf_file": pdf_filename,
                        "docx_file": docx_filename,
                        "success": success,
                        "error": None if success else "Conversion failed"
                    })
                except Exception as e:
                    results.append({
                        "pdf_file": pdf_filename,
                        "docx_file": docx_filename,
                        "success": False,
                        "error": str(e)
                    })
            
            # Print summary
            successful = sum(1 for r in results if r["success"])
            logger.info(f"\n✓ Batch conversion complete: {successful}/{len(results)} successful")
            
            return results
            
        except Exception as e:
            logger.error(f"Error in batch conversion: {e}")
            return results
    
    def get_pdf_info(self, pdf_path: str) -> dict:
        """
        Get information about a PDF file
        
        Args:
            pdf_path: Full path to PDF file
        
        Returns:
            Dictionary with PDF info:
            {
                "file_name": "...",
                "file_size": "...",
                "total_pages": 10,
                "error": None
            }
        """
        cv = None
        try:
            if not os.path.exists(pdf_path):
                return {
                    "file_name": None,
                    "file_size": None,
                    "total_pages": 0,
                    "error": "File not found"
                }
            
            cv = Converter(pdf_path)
            cv.load_pages()
            num_pages = len(cv.pages)
            cv.close()
            cv = None
            
            file_size = os.path.getsize(pdf_path)
            
            return {
                "file_name": os.path.basename(pdf_path),
                "file_size": file_size,
                "total_pages": num_pages,
                "error": None
            }
        except Exception as e:
            return {
                "file_name": os.path.basename(pdf_path) if os.path.exists(pdf_path) else None,
                "file_size": None,
                "total_pages": 0,
                "error": str(e)
            }
        finally:
            if cv is not None:
                try:
                    cv.close()
                except Exception:
                    pass


# Singleton instance
pdf_converter = PDFtoDocxConverter()
