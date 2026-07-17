from neo4j import GraphDatabase, Driver
from app.config import get_settings

settings = get_settings()

_driver: Driver | None = None


def _get_driver() -> Driver | None:
    global _driver
    if _driver is None:
        uri = settings.NEO4J_URI
        user = settings.NEO4J_USER
        password = settings.NEO4J_PASSWORD
        if not uri or not user or not password:
            return None
        try:
            _driver = GraphDatabase.driver(uri, auth=(user, password))
            _driver.verify_connectivity()
        except Exception:
            return None
    return _driver


def close_driver():
    global _driver
    if _driver:
        _driver.close()
        _driver = None


def _run_query(query: str, params: dict | None = None) -> list[dict]:
    driver = _get_driver()
    if not driver:
        return []
    try:
        with driver.session() as session:
            result = session.run(query, params or {})
            return [r.data() for r in result]
    except Exception:
        return []


def create_equipment_node(equipment_id: str, name: str, asset_id: str = "") -> None:
    q = """
    MERGE (e:Equipment {id: $equipment_id})
    SET e.name = $name, e.asset_id = $asset_id
    """
    _run_query(q, {"equipment_id": equipment_id, "name": name, "asset_id": asset_id})


def create_plant_node(plant_id: str, name: str) -> None:
    q = """
    MERGE (p:Plant {id: $plant_id})
    SET p.name = $name
    """
    _run_query(q, {"plant_id": plant_id, "name": name})


def create_report_node(report_id: str, filename: str, document_id: int) -> None:
    q = """
    MERGE (r:Report {id: $report_id})
    SET r.filename = $filename, r.document_id = $document_id
    """
    _run_query(q, {"report_id": report_id, "filename": filename, "document_id": document_id})


def create_operator_node(operator_id: str, name: str) -> None:
    q = """
    MERGE (o:Operator {id: $operator_id})
    SET o.name = $name
    """
    _run_query(q, {"operator_id": operator_id, "name": name})


def create_failure_node(failure_id: str, failure_type: str) -> None:
    q = """
    MERGE (f:Failure {id: $failure_id})
    SET f.type = $failure_type
    """
    _run_query(q, {"failure_id": failure_id, "failure_type": failure_type})


def create_maintenance_record_node(record_id: str, date: str) -> None:
    q = """
    MERGE (m:MaintenanceRecord {id: $record_id})
    SET m.date = $date
    """
    _run_query(q, {"record_id": record_id, "date": date})


def create_relationship(from_id: str, from_label: str, rel_type: str, to_id: str, to_label: str, properties: dict | None = None) -> None:
    props = properties or {}
    set_clause = ""
    if props:
        set_clause = "SET " + ", ".join(f"r.{k} = ${k}" for k in props)
    q = f"""
    MATCH (a:{from_label} {{id: $from_id}})
    MATCH (b:{to_label} {{id: $to_id}})
    MERGE (a)-[r:{rel_type}]->(b)
    {set_clause}
    """
    params = {"from_id": from_id, "to_id": to_id, **props}
    _run_query(q, params)


def build_graph_from_entities(document_id: int, filename: str, entities: list[dict]) -> None:
    if not entities:
        return

    report_id = f"report_{document_id}"

    # Collect unique entities by type
    equipment_vals = []
    plant_vals = []
    operator_vals = []
    failure_vals = []
    maintenance_vals = []
    asset_ids = []

    for ent in entities:
        t = ent.get("type", "")
        v = ent.get("value", "").strip()
        if not v:
            continue
        if t == "Equipment":
            equipment_vals.append(v)
        elif t == "Plant":
            plant_vals.append(v)
        elif t == "Asset ID":
            asset_ids.append(v)
        elif t == "Technician":
            operator_vals.append(v)
        elif t == "Failure Type":
            failure_vals.append(v)
        elif t == "Maintenance Date":
            maintenance_vals.append(v)

    driver = _get_driver()
    if not driver:
        return

    try:
        with driver.session() as session:
            # Create report node
            session.run(
                "MERGE (r:Report {id: $id}) SET r.filename = $filename, r.document_id = $doc_id",
                {"id": report_id, "filename": filename, "doc_id": document_id},
            )

            # Create and link equipment nodes
            for eq in equipment_vals:
                eq_id = eq.replace(" ", "_").replace("/", "_").lower()
                session.run(
                    "MERGE (e:Equipment {id: $id}) SET e.name = $name",
                    {"id": eq_id, "name": eq},
                )
                session.run(
                    "MATCH (r:Report {id: $rid}), (e:Equipment {id: $eid}) MERGE (r)-[:REFERENCES]->(e)",
                    {"rid": report_id, "eid": eq_id},
                )

            # Create and link plant nodes
            for pl in plant_vals:
                pl_id = pl.replace(" ", "_").replace("/", "_").lower()
                session.run(
                    "MERGE (p:Plant {id: $id}) SET p.name = $name",
                    {"id": pl_id, "name": pl},
                )
                session.run(
                    "MATCH (r:Report {id: $rid}), (p:Plant {id: $pid}) MERGE (r)-[:BELONGS_TO]->(p)",
                    {"rid": report_id, "pid": pl_id},
                )
                for eq in equipment_vals:
                    eq_id = eq.replace(" ", "_").replace("/", "_").lower()
                    session.run(
                        "MATCH (e:Equipment {id: $eid}), (p:Plant {id: $pid}) MERGE (e)-[:LOCATED_IN]->(p)",
                        {"eid": eq_id, "pid": pl_id},
                    )

            # Create and link operator nodes
            for op in operator_vals:
                op_id = op.replace(" ", "_").replace("/", "_").lower()
                session.run(
                    "MERGE (o:Operator {id: $id}) SET o.name = $name",
                    {"id": op_id, "name": op},
                )
                session.run(
                    "MATCH (r:Report {id: $rid}), (o:Operator {id: $oid}) MERGE (r)-[:PREPARED_BY]->(o)",
                    {"rid": report_id, "oid": op_id},
                )

            # Link asset IDs to equipment
            for asset in asset_ids:
                for eq in equipment_vals:
                    eq_id = eq.replace(" ", "_").replace("/", "_").lower()
                    session.run(
                        "MATCH (e:Equipment {id: $eid}) SET e.asset_id = $asset",
                        {"eid": eq_id, "asset": asset},
                    )

            # Create and link failure nodes
            for fail in failure_vals:
                fail_id = fail.replace(" ", "_").replace("/", "_").lower()
                session.run(
                    "MERGE (f:Failure {id: $id}) SET f.type = $type",
                    {"id": fail_id, "type": fail},
                )
                session.run(
                    "MATCH (r:Report {id: $rid}), (f:Failure {id: $fid}) MERGE (r)-[:MENTIONS]->(f)",
                    {"rid": report_id, "fid": fail_id},
                )
                for eq in equipment_vals:
                    eq_id = eq.replace(" ", "_").replace("/", "_").lower()
                    session.run(
                        "MATCH (e:Equipment {id: $eid}), (f:Failure {id: $fid}) MERGE (e)-[:HAS_FAILURE]->(f)",
                        {"eid": eq_id, "fid": fail_id},
                    )

            # Create and link maintenance record nodes
            for dt in maintenance_vals:
                dt_id = f"maint_{document_id}_{dt.replace(' ', '_').replace('/', '_')}"
                session.run(
                    "MERGE (m:MaintenanceRecord {id: $id}) SET m.date = $date",
                    {"id": dt_id, "date": dt},
                )
                session.run(
                    "MATCH (r:Report {id: $rid}), (m:MaintenanceRecord {id: $mid}) MERGE (r)-[:RECORDS]->(m)",
                    {"rid": report_id, "mid": dt_id},
                )
                for eq in equipment_vals:
                    eq_id = eq.replace(" ", "_").replace("/", "_").lower()
                    session.run(
                        "MATCH (e:Equipment {id: $eid}), (m:MaintenanceRecord {id: $mid}) MERGE (m)-[:PERFORMED_ON]->(e)",
                        {"eid": eq_id, "mid": dt_id},
                    )
                for op in operator_vals:
                    op_id = op.replace(" ", "_").replace("/", "_").lower()
                    session.run(
                        "MATCH (o:Operator {id: $oid}), (m:MaintenanceRecord {id: $mid}) MERGE (o)-[:PERFORMED]->(m)",
                        {"oid": op_id, "mid": dt_id},
                    )

    except Exception:
        pass


def get_full_graph() -> dict:
    driver = _get_driver()
    if not driver:
        return {"nodes": [], "edges": []}

    try:
        with driver.session() as session:
            nodes_result = session.run("""
                MATCH (n)
                RETURN n.id AS id, n.asset_id AS asset_id,
                       labels(n) AS labels,
                       n.name AS name, n.canonical_name AS canonical_name,
                       n.type AS type, n.filename AS filename, n.date AS date,
                       n.attribute AS attribute, n.value AS value
            """)
            nodes = []
            for r in nodes_result:
                d = r.data()
                label = d["labels"][0] if d.get("labels") else ""
                node_id = d.get("id") or d.get("asset_id") or ""
                node_name = (
                    d.get("canonical_name") or d.get("name") or
                    d.get("filename") or d.get("type") or
                    d.get("date") or d.get("attribute") or
                    d.get("value") or node_id
                )
                if label == "AssetClaim":
                    conflict = d.get("value", "")
                    node_name = f"{d.get('attribute', '?')}: {d.get('value', '?')}"
                nodes.append({
                    "id": node_id,
                    "label": label,
                    "name": node_name,
                })

            edges_result = session.run("""
                MATCH (a)-[r]->(b)
                RETURN coalesce(a.id, a.asset_id) AS source,
                       coalesce(b.id, b.asset_id) AS target,
                       type(r) AS label
            """)
            edges = [r.data() for r in edges_result]

        return {"nodes": nodes, "edges": edges}
    except Exception:
        return {"nodes": [], "edges": []}


def get_graph_by_document(document_id: int) -> dict:
    report_id = f"report_{document_id}"
    driver = _get_driver()
    if not driver:
        return {"nodes": [], "edges": []}

    try:
        with driver.session() as session:
            nodes = []
            edges = []
            seen_ids = set()

            result = session.run("""
                MATCH (r:Report {id: $rid})
                OPTIONAL MATCH (r)-[rel]-(n)
                RETURN r.id AS rid, r.filename AS rfilename,
                       n.id AS nid, labels(n) AS nlabels, n.name AS nname,
                       n.type AS ntype, n.filename AS nfilename, n.date AS ndate,
                       type(rel) AS rel_type
            """, {"rid": report_id})

            for rec in result:
                rd = rec.data()
                if rd.get("rid") and rd["rid"] not in seen_ids:
                    seen_ids.add(rd["rid"])
                    nodes.append({
                        "id": rd["rid"],
                        "label": "Report",
                        "name": rd.get("rfilename") or rd["rid"],
                    })
                if rd.get("nid") and rd["nid"] not in seen_ids:
                    seen_ids.add(rd["nid"])
                    nlabels = rd.get("nlabels") or []
                    label = nlabels[0] if nlabels else ""
                    nodes.append({
                        "id": rd["nid"],
                        "label": label,
                        "name": rd.get("nname") or rd.get("ntype") or rd.get("nfilename") or rd.get("ndate") or rd["nid"],
                    })
                if rd.get("rel_type") and rd.get("rid") and rd.get("nid"):
                    edges.append({
                        "source": rd["rid"],
                        "target": rd["nid"],
                        "label": rd["rel_type"],
                    })

            eq_result = session.run("""
                MATCH (r:Report {id: $rid})-[:REFERENCES]->(e:Equipment)
                OPTIONAL MATCH (e)-[rel]-(n)
                WHERE n:Failure OR n:Plant OR n:MaintenanceRecord
                RETURN e.id AS eid, e.name AS ename,
                       n.id AS nid, labels(n) AS nlabels, n.name AS nname,
                       n.type AS ntype, n.date AS ndate,
                       type(rel) AS rel_type
            """, {"rid": report_id})

            claim_result = session.run("""
                MATCH (r:Report {id: $rid})-[:MAKES_CLAIM]->(c:AssetClaim)
                OPTIONAL MATCH (c)<-[:HAS_CLAIM]-(a:Asset)
                RETURN c.id AS cid, c.attribute AS cattr, c.value AS cval,
                       c.conflicts_with_canonical AS cconflict,
                       a.asset_id AS aid, a.canonical_name AS aname
            """, {"rid": report_id})

            for rec in eq_result:
                rd = rec.data()
                if rd.get("eid") and rd["eid"] not in seen_ids:
                    seen_ids.add(rd["eid"])
                    nodes.append({
                        "id": rd["eid"],
                        "label": "Equipment",
                        "name": rd.get("ename") or rd["eid"],
                    })
                if rd.get("nid") and rd["nid"] not in seen_ids:
                    seen_ids.add(rd["nid"])
                    nlabels = rd.get("nlabels") or []
                    label = nlabels[0] if nlabels else ""
                    nodes.append({
                        "id": rd["nid"],
                        "label": label,
                        "name": rd.get("nname") or rd.get("ntype") or rd.get("ndate") or rd["nid"],
                    })
                if rd.get("rel_type") and rd.get("eid") and rd.get("nid"):
                    edges.append({
                        "source": rd["eid"],
                        "target": rd["nid"],
                        "label": rd["rel_type"],
                    })

            for rec in claim_result:
                rd = rec.data()
                if rd.get("aid") and rd["aid"] not in seen_ids:
                    seen_ids.add(rd["aid"])
                    nodes.append({
                        "id": rd["aid"],
                        "label": "Asset",
                        "name": rd.get("aname") or rd["aid"],
                    })
                if rd.get("cid") and rd["cid"] not in seen_ids:
                    seen_ids.add(rd["cid"])
                    conflict_flag = rd.get("cconflict", False)
                    display = f"{rd.get('cattr', '?')}: {rd.get('cval', '?')}"
                    if conflict_flag:
                        display += " ⚠"
                    nodes.append({
                        "id": rd["cid"],
                        "label": "AssetClaim",
                        "name": display,
                    })
                    edges.append({
                        "source": rd["cid"],
                        "target": rd["aid"],
                        "label": "ABOUT",
                    })
                    edges.append({
                        "source": report_id,
                        "target": rd["cid"],
                        "label": "MAKES_CLAIM",
                    })

        return {"nodes": nodes, "edges": edges}
    except Exception:
        return {"nodes": [], "edges": []}


def clear_graph():
    _run_query("MATCH (n) DETACH DELETE n")


def cleanup_orphans():
    driver = _get_driver()
    if not driver:
        return
    try:
        with driver.session() as session:
            session.run("""
                MATCH (n)
                WHERE NOT (n:Report)
                  AND NOT EXISTS { MATCH (n)-[*]-(:Report) }
                DETACH DELETE n
            """)
    except Exception:
        pass
