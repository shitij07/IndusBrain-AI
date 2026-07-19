import os
import time
import hashlib
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.document import Document
from app.models.entity import ExtractedEntity
from app.services.graph_service import _get_driver
from app.services.gemini_client import get_gemini_client
from app.config import get_settings

router = APIRouter(prefix="/search", tags=["search"])
settings = get_settings()

_cache: dict[str, dict] = {}
_last_call: float = 0
_MIN_INTERVAL = 5.0


def _search_documents(query: str, db) -> list[dict]:
    results = db.query(Document).filter(
        Document.text_content.ilike(f"%{query}%"),
    ).order_by(Document.uploaded_at.desc()).limit(10).all()

    return [
        {
            "id": doc.id,
            "title": doc.original_filename,
            "mime_type": doc.mime_type,
            "file_size": doc.file_size,
            "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else None,
            "snippet": _get_snippet(doc.text_content, query),
            "type": "document",
        }
        for doc in results
    ]


def _search_equipment(query: str, db) -> list[dict]:
    entities = db.query(ExtractedEntity).filter(
        ExtractedEntity.entity_type == "Equipment",
        ExtractedEntity.entity_value.ilike(f"%{query}%"),
    ).limit(10).all()

    results = []
    seen = set()
    for ent in entities:
        if ent.entity_value not in seen:
            seen.add(ent.entity_value)
            doc = db.query(Document).filter(Document.id == ent.document_id).first()
            results.append({
                "id": ent.id,
                "name": ent.entity_value,
                "document_id": ent.document_id,
                "document_filename": doc.original_filename if doc else None,
                "confidence": ent.confidence,
                "type": "equipment",
            })

    try:
        driver = _get_driver()
        if driver:
            with driver.session() as session:
                neo_result = session.run(
                    "MATCH (e:Equipment) WHERE toLower(e.name) CONTAINS toLower($q) RETURN e.id AS id, e.name AS name, e.asset_id AS asset_id",
                    {"q": query},
                )
                for r in neo_result:
                    d = r.data()
                    if d["name"] not in {r["name"] for r in results}:
                        results.append({
                            "id": d["id"],
                            "name": d["name"],
                            "asset_id": d.get("asset_id"),
                            "document_id": None,
                            "document_filename": None,
                            "confidence": None,
                            "type": "equipment",
                        })
    except Exception:
        pass

    return results


def _search_reports(query: str, db) -> list[dict]:
    results = []
    try:
        driver = _get_driver()
        if driver:
            with driver.session() as session:
                neo_result = session.run(
                    "MATCH (r:Report) WHERE toLower(r.filename) CONTAINS toLower($q) RETURN r.id AS id, r.filename AS filename, r.document_id AS document_id",
                    {"q": query},
                )
                for r in neo_result:
                    d = r.data()
                    doc = db.query(Document).filter(Document.id == d["document_id"]).first() if d.get("document_id") else None
                    results.append({
                        "id": d["id"],
                        "filename": d["filename"],
                        "document_id": d.get("document_id"),
                        "document_filename": doc.original_filename if doc else None,
                        "type": "report",
                    })
    except Exception:
        pass

    return results


def _search_failures(query: str, db) -> list[dict]:
    results = []

    entities = db.query(ExtractedEntity).filter(
        ExtractedEntity.entity_type == "Failure Type",
        ExtractedEntity.entity_value.ilike(f"%{query}%"),
    ).limit(10).all()

    seen = set()
    for ent in entities:
        if ent.entity_value not in seen:
            seen.add(ent.entity_value)
            doc = db.query(Document).filter(Document.id == ent.document_id).first()
            results.append({
                "id": ent.id,
                "type": ent.entity_value,
                "document_id": ent.document_id,
                "document_filename": doc.original_filename if doc else None,
                "confidence": ent.confidence,
                "category": "failure",
            })

    try:
        driver = _get_driver()
        if driver:
            with driver.session() as session:
                neo_result = session.run(
                    "MATCH (f:Failure) WHERE toLower(f.type) CONTAINS toLower($q) RETURN f.id AS id, f.type AS type",
                    {"q": query},
                )
                for r in neo_result:
                    d = r.data()
                    if d["type"] not in {r["type"] for r in results}:
                        results.append({
                            "id": d["id"],
                            "type": d["type"],
                            "document_id": None,
                            "document_filename": None,
                            "confidence": None,
                            "category": "failure",
                        })
    except Exception:
        pass

    return results


def _search_sops(query: str, db) -> list[dict]:
    results = []

    sops = db.query(Document).filter(
        Document.original_filename.ilike(f"%sop%"),
        Document.text_content.ilike(f"%{query}%"),
    ).limit(10).all()

    for doc in sops:
        results.append({
            "id": doc.id,
            "title": doc.original_filename,
            "mime_type": doc.mime_type,
            "file_size": doc.file_size,
            "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else None,
            "snippet": _get_snippet(doc.text_content, query),
            "type": "sop",
        })

    sop_entities = db.query(ExtractedEntity).filter(
        ExtractedEntity.entity_type == "SOP Number",
        ExtractedEntity.entity_value.ilike(f"%{query}%"),
    ).limit(10).all()

    for ent in sop_entities:
        doc = db.query(Document).filter(Document.id == ent.document_id).first()
        if doc and doc.original_filename not in {r["title"] for r in results}:
            results.append({
                "id": doc.id,
                "title": doc.original_filename,
                "mime_type": doc.mime_type,
                "file_size": doc.file_size,
                "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else None,
                "snippet": _get_snippet(doc.text_content, query),
                "sop_number": ent.entity_value,
                "type": "sop",
            })

    return results


def _get_snippet(text: str | None, query: str, context_chars: int = 150) -> str:
    if not text:
        return ""
    lower_text = text.lower()
    lower_query = query.lower()
    idx = lower_text.find(lower_query)
    if idx == -1:
        return text[:context_chars] + "..."
    start = max(0, idx - context_chars // 2)
    end = min(len(text), idx + len(query) + context_chars // 2)
    snippet = text[start:end].replace("\n", " ").strip()
    if start > 0:
        snippet = "..." + snippet
    if end < len(text):
        snippet = snippet + "..."
    return snippet


def _generate_ai_summary(query: str, results: dict) -> str | None:
    client = get_gemini_client()
    try:
        _ = client.key_manager.is_configured()
    except RuntimeError:
        return None

    total_count = sum(len(v) for v in results.values())
    if total_count == 0:
        return None

    global _last_call
    now = time.time()
    if now - _last_call < _MIN_INTERVAL:
        return None
    _last_call = now

    cache_key = hashlib.md5(query.lower().encode()).hexdigest()
    cached = _cache.get(cache_key)
    if cached and time.time() - cached["time"] < 60:
        return cached["summary"]

    try:
        parts = []
        for category, items in results.items():
            if items:
                names = [item.get("title") or item.get("name") or item.get("filename") or item.get("type", "") for item in items[:3]]
                parts.append(f"{category}: {', '.join(str(n) for n in names)}")

        summary_text = "; ".join(parts)

        prompt = f"""Query: "{query}"
Results: {summary_text}

Summarize in 1 sentence what was found."""
        ai_summary = client.generate_content(prompt)
    except Exception:
        ai_summary = None

    return ai_summary


@router.get("")
def global_search(
    q: str = Query(..., min_length=1, description="Search query"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = q.strip()

    documents = _search_documents(query, db)
    equipment = _search_equipment(query, db)
    reports = _search_reports(query, db)
    failures = _search_failures(query, db)
    sops = _search_sops(query, db)

    results = {
        "documents": documents,
        "equipment": equipment,
        "reports": reports,
        "failures": failures,
        "sops": sops,
    }

    ai_summary = _generate_ai_summary(query, results)

    return {
        "query": query,
        "results": results,
        "ai_summary": ai_summary,
        "total_count": sum(len(v) for v in results.values()),
    }
