FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-ind \
    tesseract-ocr-eng \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --timeout 120 --retries 5 -r requirements.txt

COPY app ./app

ENV OCR_LANG=ind+eng
ENV OCR_PDF_DPI=200
ENV OCR_MIN_NATIVE_CHARS_PER_PAGE=40

EXPOSE 8090

CMD ["uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8090"]
