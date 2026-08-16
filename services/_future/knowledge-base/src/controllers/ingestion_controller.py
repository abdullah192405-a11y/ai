"""Ingestion controller — handles document upload and knowledge training."""

import uuid
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, Request, HTTPException
import structlog

from src.services.chunking_service import chunk_text, extract_text
from src.services.embedding_service import embed_and_store

logger = structlog.get_logger()
router = APIRouter()


@router.post("/documents")
async def upload_document(
    request: Request,
    source_type: str = Form(...),
    title: Optional[str] = Form(None),
    website_id: Optional[str] = Form(None),
    tenant_id: str = Form(...),
    source_url: Optional[str] = Form(None),
    text_content: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
):
    """Upload and process a document for the knowledge base."""
    doc_id = str(uuid.uuid4())

    logger.info("document_upload", doc_id=doc_id, source_type=source_type, tenant_id=tenant_id)

    # Step 1: Extract Text
    if source_type == "file" and file:
        content_bytes = await file.read()
        text = extract_text(content_bytes, file.filename)
    elif source_type == "text" and text_content:
        text = text_content
    elif source_type == "url" and source_url:
        import httpx
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(source_url)
            resp.raise_for_status()
            text = resp.text
    elif source_type == "faq" and text_content:
        text = text_content
    else:
        raise HTTPException(status_code=422, detail="Invalid source_type/content combination")

    if not text or len(text.strip()) < 10:
        raise HTTPException(status_code=422, detail="Extracted text is too short")

    # Step 2: Chunk
    chunks = chunk_text(text, title=title or file.filename if file else source_url or "untitled")

    # Step 3: Embed & Store
    chunk_count = await embed_and_store(
        qdrant=request.app.state.qdrant,
        chunks=chunks,
        tenant_id=tenant_id,
        doc_id=doc_id,
        source_type=source_type,
        source_url=source_url or "",
    )

    logger.info("document_indexed", doc_id=doc_id, chunk_count=chunk_count)

    return {
        "data": {
            "id": doc_id,
            "title": title or (file.filename if file else source_url),
            "status": "indexed",
            "chunk_count": chunk_count,
            "source_type": source_type,
        },
        "meta": {"version": "v1"},
    }


@router.get("/documents")
async def list_documents(request: Request, tenant_id: str, status: Optional[str] = None):
    """List all documents (metadata only — chunks are in Qdrant)."""
    # In production, this queries the PostgreSQL documents table
    return {
        "data": [],
        "meta": {"version": "v1", "total_count": 0, "has_more": False},
    }
