"""Chunking service — splits documents into semantically meaningful chunks."""

import os
import re
from typing import Optional

CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "512"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "64"))


def chunk_text(text: str, title: str = "untitled", chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[dict]:
    """
    Splits text into overlapping chunks using a sliding window approach.
    Each chunk includes metadata for retrieval context.
    """
    # Clean the text
    text = re.sub(r'\s+', ' ', text).strip()

    if len(text) <= chunk_size:
        return [{"text": text, "title": title, "index": 0, "total_chunks": 1}]

    chunks = []
    start = 0
    index = 0

    while start < len(text):
        end = start + chunk_size

        # Try to break at a sentence boundary
        if end < len(text):
            # Look for the last sentence-ending punctuation within the chunk
            last_period = text.rfind('.', start + chunk_size // 2, end)
            last_newline = text.rfind('\n', start + chunk_size // 2, end)
            break_point = max(last_period, last_newline)
            if break_point > start:
                end = break_point + 1

        chunk_text_content = text[start:end].strip()
        if chunk_text_content:
            chunks.append({
                "text": chunk_text_content,
                "title": title,
                "index": index,
            })
            index += 1

        start = end - overlap
        if start >= len(text):
            break

    # Add total_chunks to each chunk
    for c in chunks:
        c["total_chunks"] = len(chunks)

    return chunks


def extract_text(content_bytes: bytes, filename: str) -> str:
    """Extracts text from binary content based on file extension."""
    ext = filename.lower().rsplit('.', 1)[-1] if '.' in filename else ''

    if ext == 'pdf':
        try:
            from pypdf import PdfReader
            from io import BytesIO
            reader = PdfReader(BytesIO(content_bytes))
            text = '\n'.join(page.extract_text() or '' for page in reader.pages)
            return text
        except Exception as e:
            raise ValueError(f"Failed to parse PDF: {e}")

    elif ext in ('txt', 'md', 'csv'):
        return content_bytes.decode('utf-8', errors='replace')

    elif ext in ('html', 'htm'):
        from html.parser import HTMLParser

        class TextExtractor(HTMLParser):
            def __init__(self):
                super().__init__()
                self.result = []
                self.skip_tags = {'script', 'style', 'nav', 'footer', 'header'}
                self.current_tag = None

            def handle_starttag(self, tag, attrs):
                self.current_tag = tag

            def handle_data(self, data):
                if self.current_tag not in self.skip_tags:
                    self.result.append(data.strip())

        extractor = TextExtractor()
        extractor.feed(content_bytes.decode('utf-8', errors='replace'))
        return '\n'.join(filter(None, extractor.result))

    elif ext == 'json':
        import json
        data = json.loads(content_bytes)
        return json.dumps(data, indent=2)

    else:
        return content_bytes.decode('utf-8', errors='replace')
