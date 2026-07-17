import hashlib
import json
import re
import struct
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models.document import Document
from app.services.graph_service import _get_driver

MINHASH_SIGNATURE_SIZE = 32
NEAR_DUPLICATE_THRESHOLD = 0.85


def normalize_text(text: str) -> str:
    text = text.lower()
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"[^\w\s]", " ", text)
    return text.strip()


def compute_content_hash(text: str) -> str:
    normalized = normalize_text(text)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def _word_shingles(text: str, shingle_size: int = 5) -> list[str]:
    words = re.findall(r"\w+", text.lower())
    if len(words) < shingle_size:
        return [" ".join(words)] if words else []
    return [" ".join(words[i : i + shingle_size]) for i in range(len(words) - shingle_size + 1)]


def compute_minhash_signature(text: str) -> list[int]:
    shingles = _word_shingles(text)
    if not shingles:
        return []

    signature = [float("inf")] * MINHASH_SIGNATURE_SIZE
    for shingle in shingles:
        for i in range(MINHASH_SIGNATURE_SIZE):
            h = struct.unpack(
                "<I",
                hashlib.sha1(f"{i}:{shingle}".encode("utf-8")).digest()[:4],
            )[0]
            if h < signature[i]:
                signature[i] = h
    return signature


def minhash_similarity(sig1: list[int], sig2: list[int]) -> float:
    if not sig1 or not sig2:
        return 0.0
    length = min(len(sig1), len(sig2))
    if length == 0:
        return 0.0
    matches = sum(1 for i in range(length) if sig1[i] == sig2[i])
    return matches / length


def find_exact_duplicate(
    db: Session,
    content_hash: str,
    exclude_document_id: Optional[int] = None,
) -> Optional[Document]:
    query = db.query(Document).filter(Document.content_hash == content_hash)
    if exclude_document_id is not None:
        query = query.filter(Document.id != exclude_document_id)
    return query.first()


def find_near_duplicate(
    db: Session,
    signature: list[int],
    exclude_document_id: Optional[int] = None,
    threshold: float = NEAR_DUPLICATE_THRESHOLD,
) -> Optional[tuple[Document, float]]:
    if not signature:
        return None

    candidates = db.query(Document).filter(
        Document.minhash_signature.isnot(None),
        Document.text_content.isnot(None),
    )
    if exclude_document_id is not None:
        candidates = candidates.filter(Document.id != exclude_document_id)

    best_match = None
    best_score = threshold

    for doc in candidates:
        if not doc.minhash_signature or not doc.text_content:
            continue
        try:
            doc_sig = json.loads(doc.minhash_signature)
        except (json.JSONDecodeError, TypeError):
            doc_sig = compute_minhash_signature(doc.text_content)

        score = minhash_similarity(signature, doc_sig)
        if score > best_score:
            best_score = score
            best_match = doc

    if best_match:
        return (best_match, best_score)
    return None


def check_duplicate(
    db: Session,
    text: str,
    exclude_document_id: Optional[int] = None,
) -> tuple[Optional[Document], str, Optional[float]]:
    if not text or not text.strip():
        return None, "no_text", None

    content_hash = compute_content_hash(text)

    exact = find_exact_duplicate(db, content_hash, exclude_document_id)
    if exact:
        return exact, "exact", 1.0

    signature = compute_minhash_signature(text)
    near = find_near_duplicate(db, signature, exclude_document_id)
    if near:
        return near[0], "near", near[1]

    return None, "unique", None


def create_duplicate_of_edge(
    existing_document_id: int,
    new_document_id: int,
    match_type: str = "exact",
    confidence: float = 1.0,
):
    driver = _get_driver()
    if not driver:
        return
    try:
        from_id = f"report_{existing_document_id}"
        to_id = f"report_{new_document_id}"
        now = datetime.now(timezone.utc).isoformat()
        with driver.session() as session:
            # Ensure both Report nodes exist
            session.run(
                "MERGE (r:Report {id: $id}) SET r.document_id = $did",
                {"id": from_id, "did": existing_document_id},
            )
            session.run(
                "MERGE (r:Report {id: $id}) SET r.document_id = $did",
                {"id": to_id, "did": new_document_id},
            )
            session.run(
                """
                MATCH (a:Report {id: $from_id})
                MATCH (b:Report {id: $to_id})
                MERGE (a)-[r:DUPLICATE_OF]->(b)
                SET r.match_type = $match_type,
                    r.confidence = $confidence,
                    r.created_at = $now
                """,
                {
                    "from_id": from_id,
                    "to_id": to_id,
                    "match_type": match_type,
                    "confidence": confidence,
                    "now": now,
                },
            )
    except Exception:
        pass
