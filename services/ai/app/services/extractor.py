import io
import logging
from typing import BinaryIO
import fitz  # PyMuPDF
import docx

logger = logging.getLogger("ai-service.extractor")

class ExtractionError(Exception):
    pass

class ResumeExtractor:
    @staticmethod
    def extract_from_pdf(stream: BinaryIO) -> str:
        """Extract plain structured text from a PDF file stream using PyMuPDF."""
        try:
            doc = fitz.open(stream=stream.read(), filetype="pdf")
            if doc.page_count == 0:
                raise ExtractionError("PDF file contains no pages.")

            extracted_chunks = []
            for page_num in range(doc.page_count):
                page = doc.load_page(page_num)
                text = page.get_text("text")
                if text and text.strip():
                    extracted_chunks.append(text.strip())

            result = "\n\n".join(extracted_chunks).strip()
            if not result:
                raise ExtractionError("PDF file contains no readable text.")
            return result
        except Exception as e:
            if isinstance(e, ExtractionError):
                raise
            logger.error(f"PyMuPDF PDF extraction failed: {e}")
            raise ExtractionError(f"Failed to extract text from PDF: {str(e)}")

    @staticmethod
    def extract_from_docx(stream: BinaryIO) -> str:
        """Extract plain structured text from a DOCX file stream using python-docx."""
        try:
            doc = docx.Document(stream)
            paragraphs = []

            for p in doc.paragraphs:
                clean_text = p.text.strip()
                if clean_text:
                    # If it looks like a list item or heading, preserve boundary
                    paragraphs.append(clean_text)

            # Also extract text inside tables (resumes often use tables for layouts)
            for table in doc.tables:
                for row in table.rows:
                    row_texts = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                    if row_texts:
                        paragraphs.append(" | ".join(dict.fromkeys(row_texts)))

            result = "\n".join(paragraphs).strip()
            if not result:
                raise ExtractionError("DOCX file contains no readable text.")
            return result
        except Exception as e:
            if isinstance(e, ExtractionError):
                raise
            logger.error(f"python-docx extraction failed: {e}")
            raise ExtractionError(f"Failed to extract text from DOCX: {str(e)}")

    @classmethod
    def extract_text(cls, file_content: bytes, file_type: str) -> str:
        """Extract text given raw bytes and file type ('pdf' or 'docx')."""
        stream = io.BytesIO(file_content)
        norm_type = file_type.lower().strip().lstrip(".")
        if norm_type == "pdf":
            return cls.extract_from_pdf(stream)
        elif norm_type in ["docx", "doc"]:
            return cls.extract_from_docx(stream)
        else:
            raise ExtractionError(f"Unsupported file type: {file_type}. Only PDF and DOCX are supported.")

resume_extractor = ResumeExtractor()
