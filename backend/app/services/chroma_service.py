import os
import re
import uuid
from typing import Optional

import chromadb
from chromadb.config import Settings as ChromaSettings

from app.config import get_settings
from app.services.gemini_client import get_gemini_client, GeminiClientError

settings = get_settings()


def _get_client() -> chromadb.PersistentClient:
    os.makedirs(settings.CHROMA_PERSIST_DIR, exist_ok=True)
    return chromadb.PersistentClient(
        path=settings.CHROMA_PERSIST_DIR,
        settings=ChromaSettings(anonymized_telemetry=False),
    )


def _get_collection():
    client = _get_client()
    return client.get_or_create_collection(
        name=settings.CHROMA_COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )


def _generate_embedding(text: str) -> list[float]:
    client = get_gemini_client()
    try:
        return client.embed_content(text)
    except GeminiClientError:
        raise ValueError(
            "Gemini API key not configured. "
            "Set GEMINI_API_KEY or GEMINI_API_KEYS in .env"
        )


def chunk_text(text: str, chunk_size: int = None, chunk_overlap: int = None) -> list[str]:
    if chunk_size is None:
        chunk_size = settings.CHUNK_SIZE
    if chunk_overlap is None:
        chunk_overlap = settings.CHUNK_OVERLAP

    chunks = []
    paragraphs = re.split(r"\n\s*\n", text.strip())
    current_chunk = ""

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        if len(current_chunk) + len(para) + 1 <= chunk_size:
            current_chunk = (current_chunk + "\n\n" + para).strip()
        else:
            if current_chunk:
                chunks.append(current_chunk)
            if len(para) > chunk_size:
                sentences = re.split(r"(?<=[.!?])\s+", para)
                temp = ""
                for sent in sentences:
                    if len(temp) + len(sent) + 1 <= chunk_size:
                        temp = (temp + " " + sent).strip()
                    else:
                        if temp:
                            chunks.append(temp)
                        temp = sent
                if temp:
                    current_chunk = temp
                else:
                    current_chunk = ""
            else:
                current_chunk = para

    if current_chunk:
        chunks.append(current_chunk)
    return chunks


def _detect_pages(text: str) -> str:
    pages = re.findall(r"\[Page (\d+)\]", text)
    if pages:
        if len(pages) == 1:
            return pages[0]
        return f"{pages[0]}-{pages[-1]}"
    return ""


def index_document(document_id: int, text: str, metadata: dict) -> int:
    if not text or not text.strip():
        return 0

    chunks = chunk_text(text)
    if not chunks:
        return 0

    collection = _get_collection()
    ids = []
    documents = []
    metadatas = []

    for i, chunk in enumerate(chunks):
        ids.append(str(uuid.uuid4()))
        documents.append(chunk)
        page = _detect_pages(chunk)
        meta = {
            "document_id": document_id,
            "chunk_index": i,
            "total_chunks": len(chunks),
            "pages": page,
        }
        meta.update(metadata)
        metadatas.append(meta)

    embeddings = [_generate_embedding(chunk) for chunk in chunks]

    collection.add(
        ids=ids,
        embeddings=embeddings,
        documents=documents,
        metadatas=metadatas,
    )
    return len(chunks)


def delete_document_chunks(document_id: int):
    collection = _get_collection()
    results = collection.get(where={"document_id": document_id})
    if results and results["ids"]:
        collection.delete(ids=results["ids"])


def query_similar(query: str, top_k: int = 5, where: Optional[dict] = None) -> list[dict]:
    collection = _get_collection()
    query_embedding = _generate_embedding(query)
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k,
        where=where,
    )
    hits = []
    if results and results["ids"]:
        for i in range(len(results["ids"][0])):
            hits.append({
                "id": results["ids"][0][i],
                "document": results["documents"][0][i],
                "metadata": results["metadatas"][0][i],
                "distance": results["distances"][0][i] if results.get("distances") else None,
            })
    return hits


def generate_answer(question: str, context_chunks: list[dict]) -> dict:
    client = get_gemini_client()

    sources = []
    context_parts = []
    for i, chunk in enumerate(context_chunks):
        meta = chunk["metadata"]
        source_name = meta.get("original_filename", f"Document {meta['document_id']}")
        pages = meta.get("pages", "")
        chunk_label = f"Chunk {meta['chunk_index'] + 1}/{meta['total_chunks']}"
        page_info = f" (Page {pages})" if pages else ""
        label = f"[Source {i + 1}] {source_name}{page_info} ({chunk_label})"
        context_parts.append(f"{label}\n{chunk['document']}")
        sources.append({
            "source": source_name,
            "pages": pages or None,
            "chunk_index": meta["chunk_index"],
            "total_chunks": meta["total_chunks"],
            "document_id": meta["document_id"],
            "distance": chunk.get("distance"),
        })

    context_text = "\n\n".join(context_parts)

    prompt = f"""You are an AI assistant for IndusBrain AI. Answer the user's question based ONLY on the provided context. If the context does not contain enough information to answer, say so clearly.

For each fact or statement you make, cite the source using the [Source X] labels in your answer. Always include the source name and page numbers when available.

Context:
{context_text}

Question: {question}

Answer:"""

    answer_text = client.generate_content(prompt)

    return {
        "answer": answer_text,
        "sources": sources,
    }
