import io
import os
from pathlib import Path

import fitz
import pytesseract
from fastapi import FastAPI, File, HTTPException, UploadFile
from pdf2image import convert_from_bytes
from PIL import Image

app = FastAPI(title="MyOrg OCR Service", version="1.0.0")

OCR_LANG = os.getenv("OCR_LANG", "ind+eng")
PDF_DPI = int(os.getenv("OCR_PDF_DPI", "200"))
MIN_NATIVE_CHARS = int(os.getenv("OCR_MIN_NATIVE_CHARS_PER_PAGE", "40"))

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tif", ".tiff"}


def _ocr_image(img: Image.Image) -> str:
    return pytesseract.image_to_string(img, lang=OCR_LANG).strip()


def extract_pdf(data: bytes) -> tuple[str, str, int]:
    doc = fitz.open(stream=data, filetype="pdf")
    pages = doc.page_count
    if pages == 0:
        return "", "empty", 0

    native_parts: list[str] = []
    for page in doc:
        text = page.get_text("text").strip()
        if text:
            native_parts.append(text)
    native = "\n\n".join(native_parts).strip()
    avg_chars = len(native) / pages if pages else 0

    if avg_chars >= MIN_NATIVE_CHARS:
        return native, "native", pages

    images = convert_from_bytes(data, dpi=PDF_DPI)
    ocr_parts = [_ocr_image(img) for img in images]
    ocr_text = "\n\n".join(part for part in ocr_parts if part).strip()
    if native and ocr_text:
        return ocr_text or native, "ocr", pages
    return ocr_text or native, "ocr" if ocr_text else "native", pages


def extract_image(data: bytes) -> tuple[str, str, int]:
    img = Image.open(io.BytesIO(data))
    return _ocr_image(img), "ocr", 1


@app.get("/health")
def health():
    return {"status": "ok", "lang": OCR_LANG}


@app.post("/extract")
async def extract(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="filename required")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="empty file")

    ext = Path(file.filename).suffix.lower()
    try:
        if ext == ".pdf":
            text, method, pages = extract_pdf(data)
        elif ext in IMAGE_EXT:
            text, method, pages = extract_image(data)
        else:
            raise HTTPException(
                status_code=400,
                detail=f"unsupported file type: {ext or 'unknown'}",
            )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {
        "text": text,
        "method": method,
        "pages": pages,
        "filename": file.filename,
    }
