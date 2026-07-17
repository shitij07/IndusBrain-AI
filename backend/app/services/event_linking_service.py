import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from app.services.graph_service import _get_driver, _run_query
from app.services.asset_resolver import parse_failure_history_csv

CONFIDENCE_THRESHOLD = 0.45
WEIGHT_ASSET = 0.40
WEIGHT_DATE = 0.30
WEIGHT_TEXT = 0.30

DATE_PATTERNS = [
    (r"(\d{4}-\d{2}-\d{2})", "%Y-%m-%d"),
    (r"(\d{2}/\d{2}/\d{4})", "%m/%d/%Y"),
    (r"(\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4})", "%d %B %Y"),
    (r"(\d{1,2}\s+[A-Z][a-z]+\s+\d{4})", "%d %B %Y"),
    (r"((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4})", "%B %d, %Y"),
]

ASSET_ID_PATTERN = re.compile(r"[A-Z]{2,4}[-_][0-9A-Z]{3,6}")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id() -> str:
    return f"evt_{uuid.uuid4().hex[:10]}"


def extract_dates_from_text(text: str) -> list[str]:
    if not text:
        return []
    found = []
    for pattern, fmt in DATE_PATTERNS:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            try:
                dt = datetime.strptime(match.group(1), fmt)
                found.append(dt.strftime("%Y-%m-%d"))
            except ValueError:
                continue
    return found


def extract_asset_ids_from_text(text: str) -> list[str]:
    if not text:
        return []
    return list(set(ASSET_ID_PATTERN.findall(text)))


def extract_equipment_names_from_text(text: str, entities: list[dict]) -> list[str]:
    names = []
    if entities:
        for ent in entities:
            if ent.get("type") == "Equipment" and ent.get("value", "").strip():
                names.append(ent["value"].strip())
    if text:
        patterns = [
            r"(?:Pump|Compressor|Valve|Motor|Conveyor|Tank|Fan|Boiler|Turbine)\s+[-]?\s*[A-Z0-9][-A-Z0-9]*",
            r"[A-Z]{2,3}[-]\d{3}",
        ]
        for pat in patterns:
            names.extend(re.findall(pat, text, re.IGNORECASE))
    return list(set(names))


def compute_asset_score(
    incident_text: str,
    incident_entities: list[dict] | None,
    failure_event: dict,
) -> float:
    fe_asset_id = (failure_event.get("asset_id") or "").strip().upper()
    fe_equipment = (failure_event.get("equipment") or "").strip().lower()

    if not fe_asset_id and not fe_equipment:
        return 0.0

    text_upper = (incident_text or "").upper()

    if fe_asset_id and fe_asset_id in text_upper:
        return 1.0

    if fe_equipment and fe_equipment in text_upper.lower():
        return 0.7

    if incident_entities:
        entity_values = [e.get("value", "").strip().upper() for e in incident_entities if e.get("value")]
        if fe_asset_id and fe_asset_id in entity_values:
            return 0.9
        for val in entity_values:
            if fe_equipment and fe_equipment == val.lower():
                return 0.8

    return 0.0


def _parse_date_loose(date_str: str) -> Optional[datetime]:
    if not date_str:
        return None
    for pattern, fmt in DATE_PATTERNS:
        try:
            return datetime.strptime(date_str.strip(), fmt)
        except (ValueError, TypeError):
            continue
    return None


def compute_date_score(incident_text: str, failure_date_str: str) -> float:
    failure_date = _parse_date_loose(failure_date_str)
    if not failure_date:
        return 0.0

    incident_dates = extract_dates_from_text(incident_text or "")
    if not incident_dates:
        return 0.3

    best_score = 0.0
    for id_str in incident_dates:
        idt = _parse_date_loose(id_str)
        if not idt:
            continue
        diff = abs((idt - failure_date).days)
        if diff == 0:
            best_score = max(best_score, 1.0)
        elif diff <= 1:
            best_score = max(best_score, 0.9)
        elif diff <= 3:
            best_score = max(best_score, 0.7)
        elif diff <= 7:
            best_score = max(best_score, 0.5)
        elif diff <= 30:
            best_score = max(best_score, 0.2)
        else:
            best_score = max(best_score, 0.0)

    return best_score


def _tokenize(text: str) -> set[str]:
    if not text:
        return set()
    tokens = re.findall(r"[a-z][a-z0-9]+", text.lower())
    stopwords = {
        "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
        "of", "with", "by", "from", "as", "was", "were", "been", "is", "are",
        "has", "have", "had", "not", "no", "this", "that", "these", "those",
        "it", "its", "be", "will", "shall", "can", "may", "per", "each",
        "all", "any", "some", "after", "before", "during", "about", "into",
        "through", "over", "than", "then", "also", "very", "just", "due",
    }
    return {t for t in tokens if t not in stopwords and len(t) > 1}


def _failure_event_text_signature(failure_event: dict) -> str:
    parts = [
        failure_event.get("failure_type", ""),
        failure_event.get("root_cause", ""),
        failure_event.get("corrective_action", ""),
        failure_event.get("equipment", ""),
    ]
    return " ".join(p for p in parts if p)


def compute_text_similarity(incident_text: str, failure_event: dict) -> float:
    if not incident_text or not incident_text.strip():
        return 0.0

    fe_sig = _failure_event_text_signature(failure_event)
    if not fe_sig.strip():
        return 0.0

    incident_tokens = _tokenize(incident_text)
    fe_tokens = _tokenize(fe_sig)

    if not incident_tokens or not fe_tokens:
        return 0.0

    intersection = incident_tokens & fe_tokens
    if not intersection:
        return 0.0

    jaccard = len(intersection) / len(incident_tokens | fe_tokens)
    containment = len(intersection) / len(fe_tokens)

    return min((jaccard * 0.5 + containment * 0.5) * 1.5, 1.0)


def compute_confidence(
    incident_text: str,
    incident_entities: list[dict] | None,
    failure_event: dict,
) -> float:
    asset_score = compute_asset_score(incident_text, incident_entities, failure_event)
    date_score = compute_date_score(incident_text, failure_event.get("date", ""))
    text_score = compute_text_similarity(incident_text, failure_event)

    confidence = (
        asset_score * WEIGHT_ASSET +
        date_score * WEIGHT_DATE +
        text_score * WEIGHT_TEXT
    )

    return round(min(confidence, 1.0), 4)


def create_failure_event_node(failure_data: dict) -> bool:
    driver = _get_driver()
    if not driver:
        return False

    fe_id = failure_data.get("failure_id", _new_id())
    params = {
        "id": fe_id,
        "failure_type": failure_data.get("failure_type", ""),
        "root_cause": failure_data.get("root_cause", ""),
        "downtime": failure_data.get("downtime", ""),
        "corrective_action": failure_data.get("corrective_action", ""),
        "asset_id": failure_data.get("asset_id", ""),
        "equipment": failure_data.get("equipment", ""),
        "date": failure_data.get("date", ""),
        "technician": failure_data.get("technician", ""),
        "status": failure_data.get("status", ""),
        "related_sop": failure_data.get("related_sop", ""),
        "now": _now_iso(),
    }

    try:
        with driver.session() as session:
            session.run(
                """
                MERGE (f:FailureEvent {id: $id})
                SET f.failure_type = $failure_type,
                    f.root_cause = $root_cause,
                    f.downtime = $downtime,
                    f.corrective_action = $corrective_action,
                    f.asset_id = $asset_id,
                    f.equipment = $equipment,
                    f.date = $date,
                    f.technician = $technician,
                    f.status = $status,
                    f.related_sop = $related_sop,
                    f.created_at = $now
                """,
                params,
            )
        return True
    except Exception:
        return False


def ingest_failure_history_csv(csv_text: str) -> int:
    rows = parse_failure_history_csv(csv_text)
    count = 0
    for row in rows:
        if create_failure_event_node(row):
            count += 1
    return count


def get_all_failure_events() -> list[dict]:
    driver = _get_driver()
    if not driver:
        return []
    try:
        with driver.session() as session:
            result = session.run(
                "MATCH (f:FailureEvent) RETURN f { .* } AS event ORDER BY f.date"
            )
            return [dict(r["event"]) for r in result if r.get("event")]
    except Exception:
        return []


def get_all_incident_reports() -> list[dict]:
    driver = _get_driver()
    if not driver:
        return []
    try:
        with driver.session() as session:
            result = session.run(
                "MATCH (r:Report) RETURN r { .* } AS report ORDER BY r.document_id"
            )
            return [dict(r["report"]) for r in result if r.get("report")]
    except Exception:
        return []


def find_existing_links(document_id: int) -> list[dict]:
    driver = _get_driver()
    if not driver:
        return []
    report_id = f"report_{document_id}"
    try:
        with driver.session() as session:
            result = session.run(
                """
                MATCH (r:Report {id: $rid})-[rel:LIKELY_SAME_EVENT_AS]->(f:FailureEvent)
                RETURN f.id AS failure_id,
                       f.failure_type AS failure_type,
                       f.date AS failure_date,
                       f.asset_id AS asset_id,
                       rel.confidence AS confidence
                ORDER BY rel.confidence DESC
                """,
                {"rid": report_id},
            )
            return [dict(r) for r in result]
    except Exception:
        return []


def link_document_to_failures(
    document_id: int,
    filename: str,
    text: str,
    entities: list[dict] | None,
) -> list[dict]:
    if not text or not text.strip():
        return []

    failures = get_all_failure_events()
    if not failures:
        return []

    matches = []
    for fe in failures:
        confidence = compute_confidence(text, entities, fe)
        if confidence >= CONFIDENCE_THRESHOLD:
            matches.append((fe, confidence))

    matches.sort(key=lambda x: x[1], reverse=True)

    driver = _get_driver()
    if not driver:
        return []

    report_id = f"report_{document_id}"
    now = _now_iso()
    created = []

    try:
        with driver.session() as session:
            session.run(
                "MERGE (r:Report {id: $id}) SET r.filename = $filename, r.document_id = $did",
                {"id": report_id, "filename": filename, "did": document_id},
            )

            for fe, confidence in matches:
                fe_id = fe.get("id", "")
                if not fe_id:
                    continue
                session.run(
                    """
                    MATCH (r:Report {id: $rid})
                    MATCH (f:FailureEvent {id: $fid})
                    MERGE (r)-[rel:LIKELY_SAME_EVENT_AS]->(f)
                    SET rel.confidence = $confidence,
                        rel.created_at = $now,
                        rel.asset_score = $asset_score,
                        rel.date_score = $date_score,
                        rel.text_score = $text_score
                    """,
                    {
                        "rid": report_id,
                        "fid": fe_id,
                        "confidence": confidence,
                        "asset_score": compute_asset_score(text, entities, fe),
                        "date_score": compute_date_score(text, fe.get("date", "")),
                        "text_score": compute_text_similarity(text, fe),
                        "now": now,
                    },
                )
                created.append({
                    "failure_id": fe_id,
                    "failure_type": fe.get("failure_type", ""),
                    "failure_date": fe.get("date", ""),
                    "asset_id": fe.get("asset_id", ""),
                    "confidence": confidence,
                })
    except Exception:
        pass

    return created


def link_all_unmatched_documents() -> list[dict]:
    reports = get_all_incident_reports()
    if not reports:
        return []

    all_links = []
    for report in reports:
        doc_id = report.get("document_id")
        if not doc_id:
            continue

        existing = find_existing_links(doc_id)
        if existing:
            continue

        filename = report.get("filename", "")
        text = report.get("text_content") or ""

        entities = []
        from app.models.entity import ExtractedEntity
        from app.database import SessionLocal
        db = SessionLocal()
        try:
            rows = (
                db.query(ExtractedEntity)
                .filter(ExtractedEntity.document_id == doc_id)
                .all()
            )
            entities = [
                {"type": r.entity_type, "value": r.entity_value, "confidence": r.confidence}
                for r in rows
            ]
        except Exception:
            pass
        finally:
            db.close()

        links = link_document_to_failures(doc_id, filename, text, entities)
        all_links.extend(links)

    return all_links


def list_all_links() -> list[dict]:
    driver = _get_driver()
    if not driver:
        return []
    try:
        with driver.session() as session:
            result = session.run(
                """
                MATCH (r:Report)-[rel:LIKELY_SAME_EVENT_AS]->(f:FailureEvent)
                RETURN r.document_id AS document_id,
                       r.filename AS document_filename,
                       f.id AS failure_id,
                       f.failure_type AS failure_type,
                       f.date AS failure_date,
                       f.asset_id AS asset_id,
                       rel.confidence AS confidence,
                       rel.created_at AS linked_at
                ORDER BY rel.confidence DESC
                """
            )
            return [dict(r) for r in result]
    except Exception:
        return []
