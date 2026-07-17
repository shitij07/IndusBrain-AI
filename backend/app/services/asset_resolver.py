import csv
import io
import uuid
from datetime import datetime, timezone
from typing import Optional

from app.services.graph_service import _get_driver, _run_query

ASSET_REGISTER_COLUMNS = {
    "asset_id": ["asset id", "asset_id", "id", "equipment id"],
    "name": ["equipment name", "name", "equipment_name", "asset name"],
    "category": ["category", "asset category", "equipment category"],
    "plant": ["plant", "site", "facility"],
    "location": ["location", "area", "section", "unit"],
    "status": ["status", "asset status", "operational status"],
    "criticality": ["criticality", "criticality level", "priority"],
    "last_maintenance_date": ["last maintenance date", "last_maintenance_date", "last maintained"],
    "technician": ["technician", "assigned technician", "maintenance tech"],
    "manufacturer": ["manufacturer", "make", "vendor"],
    "model": ["model", "model number", "model_no"],
    "commission_year": ["commission year", "commission_year", "year commissioned", "install year"],
}

FAILURE_HISTORY_COLUMNS = {
    "failure_id": ["failure id", "failure_id", "id"],
    "date": ["date", "failure date", "event date", "occurrence date"],
    "asset_id": ["asset id", "asset_id", "equipment id"],
    "equipment": ["equipment", "equipment name", "asset name"],
    "failure_type": ["failure type", "failure_type", "failure mode", "fault type"],
    "root_cause": ["root cause", "root_cause", "cause"],
    "downtime": ["downtime", "down time", "outage duration"],
    "corrective_action": ["corrective action", "corrective_action", "action taken", "repair action"],
    "technician": ["technician", "tech", "assigned to"],
    "status": ["status", "resolution status", "repair status"],
    "related_sop": ["related sop", "related_sop", "sop reference", "sop"],
}

def ensure_constraints():
    driver = _get_driver()
    if not driver:
        return
    try:
        with driver.session() as session:
            session.run("CREATE CONSTRAINT IF NOT EXISTS FOR (a:Asset) REQUIRE a.asset_id IS UNIQUE")
            session.run("CREATE CONSTRAINT IF NOT EXISTS FOR (c:AssetClaim) REQUIRE c.id IS UNIQUE")
    except Exception:
        pass


ensure_constraints()

CANONICAL_ATTRIBUTES = [
    "name", "category", "plant", "location", "status", "criticality",
    "last_maintenance_date", "technician", "manufacturer", "model", "commission_year",
]


def _normalize_column(col: str) -> str | None:
    col_lower = col.strip().lower().replace("-", " ").replace("_", " ")
    for canonical, variants in ASSET_REGISTER_COLUMNS.items():
        if col_lower in variants or col_lower == canonical:
            return canonical
        for v in variants:
            if col_lower == v.lower().replace("-", " ").replace("_", " "):
                return canonical
    return None


def _norm_header(header: str) -> str:
    return header.strip().lower().replace(" ", "_").replace("-", "_")


def _parse_csv_text(csv_text: str, column_map: dict) -> list[dict]:
    reader = csv.DictReader(io.StringIO(csv_text))
    if not reader.fieldnames:
        return []

    headers = {h: _norm_header(h) for h in reader.fieldnames}
    reverse_map = {}
    for canonical, variants in column_map.items():
        for h_orig, h_norm in headers.items():
            if h_norm in variants or h_norm == canonical:
                reverse_map[h_orig] = canonical
                break

    rows = []
    for row in reader:
        mapped = {}
        for orig_key, val in row.items():
            canonical_key = reverse_map.get(orig_key)
            if canonical_key:
                mapped[canonical_key] = val.strip() if val else ""
        if mapped.get("asset_id"):
            rows.append(mapped)
    return rows


def _claim_id() -> str:
    return f"claim_{uuid.uuid4().hex[:12]}"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def upsert_canonical_asset(asset_data: dict) -> bool:
    driver = _get_driver()
    if not driver or not asset_data.get("asset_id"):
        return False

    asset_id = asset_data["asset_id"].strip()
    set_parts = ["a.asset_id = $asset_id"]
    params = {"asset_id": asset_id}

    for attr in CANONICAL_ATTRIBUTES:
        if attr in asset_data and asset_data[attr]:
            key = f"canonical_{attr}"
            param_key = attr
            set_parts.append(f"a.{key} = ${param_key}")
            params[param_key] = str(asset_data[attr]).strip()

    set_clause = "SET " + ", ".join(set_parts)
    q = f"""
    MERGE (a:Asset {{asset_id: $asset_id}})
    ON CREATE SET a.created_at = $now
    {set_clause}
    """
    params["now"] = _now_iso()

    try:
        with driver.session() as session:
            session.run(q, params)
        return True
    except Exception:
        return False


def add_asset_claim(
    asset_id: str,
    attribute: str,
    value: str,
    source_document_id: int,
    source_document_filename: str,
    confidence: float,
    source_document_type: str = "Document",
) -> dict | None:
    driver = _get_driver()
    if not driver or not asset_id or not attribute:
        return None

    cid = _claim_id()
    now = _now_iso()

    try:
        with driver.session() as session:
            result = session.run("""
                MATCH (a:Asset {asset_id: $asset_id})
                RETURN a.canonical_{attr} AS canonical_val
            """.replace("{attr}", attribute), {"asset_id": asset_id})
            record = result.single()
            canonical_val = record["canonical_val"] if record else None

            conflicts = False
            if canonical_val is not None and value.lower() != canonical_val.lower():
                conflicts = True

            session.run("""
                MATCH (a:Asset {asset_id: $asset_id})
                CREATE (c:AssetClaim {
                    id: $cid,
                    attribute: $attribute,
                    value: $value,
                    source_document_id: $source_document_id,
                    source_document_filename: $source_document_filename,
                    source_document_type: $source_document_type,
                    confidence: $confidence,
                    conflicts_with_canonical: $conflicts,
                    canonical_value: $canonical_val,
                    created_at: $now
                })
                CREATE (a)-[:HAS_CLAIM]->(c)
                WITH c
                OPTIONAL MATCH (r:Report {document_id: $source_document_id})
                FOREACH (_ IN CASE WHEN r IS NOT NULL THEN [1] ELSE [] END |
                    CREATE (r)-[:MAKES_CLAIM]->(c)
                )
            """, {
                "cid": cid,
                "asset_id": asset_id,
                "attribute": attribute,
                "value": value,
                "source_document_id": source_document_id,
                "source_document_filename": source_document_filename,
                "source_document_type": source_document_type,
                "confidence": float(confidence),
                "conflicts": conflicts,
                "canonical_val": canonical_val,
                "now": now,
            })

            return {
                "id": cid,
                "asset_id": asset_id,
                "attribute": attribute,
                "value": value,
                "canonical_value": canonical_val,
                "conflicts_with_canonical": conflicts,
                "confidence": confidence,
                "source_document_id": source_document_id,
                "source_document_filename": source_document_filename,
            }
    except Exception:
        return None


def resolve_entities_to_claims(
    asset_id: str,
    entities: list[dict],
    document_id: int,
    document_filename: str,
    document_type: str = "Document",
) -> list[dict]:
    claims_created = []

    for ent in entities:
        t = ent.get("type", "")
        v = ent.get("value", "").strip()
        confidence = ent.get("confidence", 0.5)
        if not v:
            continue

        attr = None
        if t == "Equipment":
            attr = "name"
        elif t == "Asset ID":
            continue
        elif t == "Manufacturer":
            attr = "manufacturer"
        elif t == "Model":
            attr = "model"
        elif t == "Plant":
            attr = "plant"
        elif t == "Location":
            attr = "location"
        elif t == "Criticality":
            attr = "criticality"
        elif t == "Status":
            attr = "status"
        elif t == "Technician":
            attr = "technician"
        elif t == "Category":
            attr = "category"

        if attr:
            claim = add_asset_claim(
                asset_id=asset_id,
                attribute=attr,
                value=v,
                source_document_id=document_id,
                source_document_filename=document_filename,
                confidence=confidence,
                source_document_type=document_type,
            )
            if claim:
                claims_created.append(claim)

    return claims_created


def parse_asset_register_csv(csv_text: str) -> list[dict]:
    return _parse_csv_text(csv_text, ASSET_REGISTER_COLUMNS)


def parse_failure_history_csv(csv_text: str) -> list[dict]:
    return _parse_csv_text(csv_text, FAILURE_HISTORY_COLUMNS)


def ingest_asset_register_rows(rows: list[dict]) -> int:
    count = 0
    for row in rows:
        if upsert_canonical_asset(row):
            count += 1
    return count


def get_canonical_asset(asset_id: str) -> dict | None:
    driver = _get_driver()
    if not driver:
        return None
    try:
        with driver.session() as session:
            result = session.run("""
                MATCH (a:Asset {asset_id: $asset_id})
                RETURN a { .* } AS asset
            """, {"asset_id": asset_id})
            record = result.single()
            if not record:
                return None
            return dict(record["asset"])
    except Exception:
        return None


def get_asset_with_claims(asset_id: str) -> dict | None:
    driver = _get_driver()
    if not driver:
        return None
    try:
        with driver.session() as session:
            result = session.run("""
                MATCH (a:Asset {asset_id: $asset_id})
                OPTIONAL MATCH (a)-[:HAS_CLAIM]->(c:AssetClaim)
                RETURN a { .* } AS asset,
                       collect(c { .* }) AS claims
            """, {"asset_id": asset_id})
            record = result.single()
            if not record:
                return None
            data = dict(record["asset"])
            claims = [c for c in record["claims"] if c.get("id")]
            data["claims"] = claims
            return data
    except Exception:
        return None


def get_asset_conflicts(asset_id: str) -> list[dict]:
    driver = _get_driver()
    if not driver:
        return []
    try:
        with driver.session() as session:
            result = session.run("""
                MATCH (a:Asset {asset_id: $asset_id})-[:HAS_CLAIM]->(c:AssetClaim)
                WHERE c.conflicts_with_canonical = true
                RETURN c { .* } AS claim
                ORDER BY c.created_at DESC
            """, {"asset_id": asset_id})
            return [dict(r["claim"]) for r in result]
    except Exception:
        return []


def list_all_assets() -> list[dict]:
    driver = _get_driver()
    if not driver:
        return []
    try:
        with driver.session() as session:
            result = session.run("""
                MATCH (a:Asset)
                OPTIONAL MATCH (a)-[:HAS_CLAIM]->(c:AssetClaim)
                WHERE c.conflicts_with_canonical = true
                WITH a, count(c) AS conflict_count
                RETURN a.asset_id AS asset_id,
                       a.canonical_name AS name,
                       a.canonical_category AS category,
                       a.canonical_plant AS plant,
                       a.canonical_status AS status,
                       a.canonical_criticality AS criticality,
                       conflict_count
                ORDER BY a.asset_id
            """)
            return [dict(r) for r in result]
    except Exception:
        return []


def get_report_node_ids(driver, document_id: int) -> list[str]:
    try:
        with driver.session() as session:
            result = session.run(
                "MATCH (r:Report {document_id: $did}) RETURN r.id AS rid",
                {"did": document_id},
            )
            return [r["rid"] for r in result]
    except Exception:
        return []


def recreate_report_for_document(document_id: int, filename: str):
    driver = _get_driver()
    if not driver:
        return
    report_id = f"report_{document_id}"
    try:
        with driver.session() as session:
            session.run(
                "MERGE (r:Report {id: $id}) SET r.filename = $filename, r.document_id = $doc_id",
                {"id": report_id, "filename": filename, "doc_id": document_id},
            )
    except Exception:
        pass
