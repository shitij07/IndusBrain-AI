import json
import os
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models.user import User
from app.models.document import Document
from app.schemas.document import DocumentResponse
from app.config import get_settings
from app.services.parser import extract_text
from app.services.chroma_service import index_document, delete_document_chunks
from app.services.entity_extractor import extract_entities_from_text
from app.services.graph_service import build_graph_from_entities, get_graph_by_document
from app.services.asset_resolver import (
    resolve_entities_to_claims,
    get_canonical_asset,
    parse_asset_register_csv,
    ingest_asset_register_rows,
    recreate_report_for_document,
)
from app.services.dedup_service import (
    check_duplicate,
    compute_content_hash,
    compute_minhash_signature,
    create_duplicate_of_edge,
)
from app.services.event_linking_service import link_document_to_failures, ingest_failure_history_csv
from app.models.entity import ExtractedEntity
from app.schemas.entity import EntityResponse, EntityGroupResponse

router = APIRouter(prefix="/documents", tags=["documents"])
settings = get_settings()

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/bmp",
    "image/tiff",
    "text/csv",
    "application/csv",
}

INLINE_MIME_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/bmp",
    "image/tiff",
}


@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
def upload_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type '{file.content_type}' is not allowed. Allowed: PDF, DOC, DOCX, XLS, XLSX, and image files",
        )

    max_size = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    ext = os.path.splitext(file.filename)[1] if file.filename else ""
    stored_name = f"{uuid.uuid4().hex}{ext}"

    now = datetime.now(timezone.utc)
    upload_dir = os.path.join(
        settings.UPLOAD_DIR,
        str(current_user.id),
        str(now.year),
        f"{now.month:02d}",
        f"{now.day:02d}",
    )
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, stored_name)

    file_size = 0
    with open(file_path, "wb") as f:
        while chunk := file.file.read(1024 * 1024):
            file_size += len(chunk)
            if file_size > max_size:
                f.close()
                os.remove(file_path)
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"File exceeds maximum size of {settings.MAX_UPLOAD_SIZE_MB} MB",
                )
            f.write(chunk)

    doc = Document(
        original_filename=file.filename or stored_name,
        stored_filename=stored_name,
        file_size=file_size,
        mime_type=file.content_type or "application/octet-stream",
        file_path=file_path,
        user_id=current_user.id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    try:
        text = extract_text(file_path, doc.mime_type)
        if text:
            doc.text_content = text
            db.commit()
            db.refresh(doc)

        if not text:
            return doc

        content_hash = compute_content_hash(text)
        doc.content_hash = content_hash
        db.commit()

        duplicate_target, match_type, match_confidence = None, None, None
        try:
            result = check_duplicate(db, text, exclude_document_id=doc.id)
            if result[0] is not None:
                duplicate_target = result[0]
                match_type = result[1]
                match_confidence = result[2]
        except Exception:
            pass

        if duplicate_target is not None:
            doc.duplicate_of_id = duplicate_target.id
            db.commit()

            try:
                create_duplicate_of_edge(
                    existing_document_id=duplicate_target.id,
                    new_document_id=doc.id,
                    match_type=match_type or "exact",
                    confidence=match_confidence or 1.0,
                )
            except Exception:
                pass

            return doc

        try:
            doc.minhash_signature = json.dumps(compute_minhash_signature(text))
            db.commit()
        except Exception:
            pass

        if text:
            try:
                num_chunks = index_document(
                    document_id=doc.id,
                    text=text,
                    metadata={
                        "original_filename": doc.original_filename,
                        "mime_type": doc.mime_type,
                        "user_id": doc.user_id,
                    },
                )
            except Exception:
                pass

        entities = None
        try:
            entities = extract_entities_from_text(text)
            for ent in entities:
                db.add(ExtractedEntity(
                    document_id=doc.id,
                    entity_type=ent.get("type", ""),
                    entity_value=ent.get("value", ""),
                    page_number=ent.get("page"),
                    confidence=ent.get("confidence"),
                ))
            db.commit()
        except Exception:
            pass

        if entities:
            try:
                build_graph_from_entities(doc.id, doc.original_filename, entities)
            except Exception:
                pass

        if doc.mime_type in ("text/csv", "application/csv"):
            try:
                rows = parse_asset_register_csv(text)
                if rows:
                    ingest_asset_register_rows(rows)
            except Exception:
                pass

        try:
            _resolve_asset_claims_for_document(doc.id, doc.original_filename, entities)
        except Exception:
            pass

        try:
            if text and doc.mime_type in ("text/csv", "application/csv"):
                fe_count = ingest_failure_history_csv(text)
                if fe_count > 0:
                    _link_document_to_failures(doc.id, doc.original_filename, text, entities)
        except Exception:
            pass

        try:
            if text and entities:
                has_failure_signal = any(e.get("type") in (
                    "Failure Type", "Asset ID", "Equipment", "Maintenance Date"
                ) for e in entities)
                if has_failure_signal:
                    _link_document_to_failures(doc.id, doc.original_filename, text, entities)
        except Exception:
            pass
    except Exception:
        pass

    return doc


def _resolve_asset_claims_for_document(document_id: int, filename: str, entities: list[dict] | None):
    if not entities:
        return

    asset_id_ents = [e for e in entities if e.get("type") == "Asset ID" and e.get("value", "").strip()]
    if not asset_id_ents:
        return

    recreate_report_for_document(document_id, filename)

    for ae in asset_id_ents:
        aid = ae["value"].strip()
        canonical = get_canonical_asset(aid)
        if not canonical:
            continue
        resolve_entities_to_claims(
            asset_id=aid,
            entities=entities,
            document_id=document_id,
            document_filename=filename,
            document_type="Document",
        )


def _link_document_to_failures(document_id: int, filename: str, text: str, entities: list[dict] | None):
    recreate_report_for_document(document_id, filename)
    link_document_to_failures(
        document_id=document_id,
        filename=filename,
        text=text,
        entities=entities,
    )


@router.get("", response_model=list[DocumentResponse])
def list_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Document)
        .order_by(Document.uploaded_at.desc())
        .all()
    )


@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return doc


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    if os.path.exists(doc.file_path):
        os.remove(doc.file_path)

    try:
        delete_document_chunks(doc.id)
    except Exception:
        pass

    db.query(ExtractedEntity).filter(ExtractedEntity.document_id == doc.id).delete()
    try:
        from app.services.graph_service import _get_driver, cleanup_orphans
        report_id = f"report_{doc.id}"
        driver = _get_driver()
        if driver:
            with driver.session() as session:
                session.run("MATCH (r:Report {id: $rid}) DETACH DELETE r", {"rid": report_id})
            cleanup_orphans()
    except Exception:
        pass

    db.delete(doc)
    db.commit()


@router.get("/{document_id}/download")
def download_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    if not os.path.exists(doc.file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found on disk")

    return FileResponse(
        path=doc.file_path,
        filename=doc.original_filename,
        media_type=doc.mime_type,
    )


@router.get("/{document_id}/view")
def view_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    if not os.path.exists(doc.file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found on disk")

    response = FileResponse(path=doc.file_path, media_type=doc.mime_type)
    if doc.mime_type in INLINE_MIME_TYPES:
        response.headers["Content-Disposition"] = f'inline; filename="{doc.original_filename}"'
    else:
        response.headers["Content-Disposition"] = f'attachment; filename="{doc.original_filename}"'
    return response


@router.get("/{document_id}/entities", response_model=list[EntityResponse])
def get_document_entities(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return db.query(ExtractedEntity).filter(ExtractedEntity.document_id == document_id).all()


@router.get("/entities/summary", response_model=EntityGroupResponse)
def get_entities_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    docs = db.query(Document).all()
    if not docs:
        return EntityGroupResponse(document_id=0, document_filename="", entities={})

    all_entities = (
        db.query(ExtractedEntity)
        .order_by(ExtractedEntity.entity_type)
        .all()
    )

    grouped: dict[str, list[EntityResponse]] = {}
    for ent in all_entities:
        t = ent.entity_type
        if t not in grouped:
            grouped[t] = []
        grouped[t].append(EntityResponse.model_validate(ent))

    first_doc = docs[0]
    return EntityGroupResponse(
        document_id=first_doc.id,
        document_filename=first_doc.original_filename,
        entities=grouped,
    )


@router.get("/admin/all")
def admin_list_all_documents(
    user_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    q = db.query(Document)
    if user_id:
        q = q.filter(Document.user_id == user_id)
    docs = q.order_by(Document.uploaded_at.desc()).all()
    return [
        {
            "id": d.id,
            "original_filename": d.original_filename,
            "file_size": d.file_size,
            "mime_type": d.mime_type,
            "uploaded_at": d.uploaded_at.isoformat() if d.uploaded_at else None,
            "user_id": d.user_id,
            "owner_name": d.owner.full_name if d.owner else None,
            "owner_email": d.owner.email if d.owner else None,
        }
        for d in docs
    ]


@router.delete("/admin/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    if os.path.exists(doc.file_path):
        os.remove(doc.file_path)

    try:
        delete_document_chunks(doc.id)
    except Exception:
        pass

    db.query(ExtractedEntity).filter(ExtractedEntity.document_id == doc.id).delete()
    try:
        from app.services.graph_service import _get_driver, cleanup_orphans
        report_id = f"report_{doc.id}"
        driver = _get_driver()
        if driver:
            with driver.session() as session:
                session.run("MATCH (r:Report {id: $rid}) DETACH DELETE r", {"rid": report_id})
            cleanup_orphans()
    except Exception:
        pass

    db.delete(doc)
    db.commit()


@router.post("/reprocess/{document_id}")
def reprocess_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    if not os.path.exists(doc.file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found on disk")

    try:
        delete_document_chunks(doc.id)
    except Exception:
        pass

    db.query(ExtractedEntity).filter(ExtractedEntity.document_id == doc.id).delete()
    try:
        from app.services.graph_service import _get_driver, cleanup_orphans
        report_id = f"report_{doc.id}"
        driver = _get_driver()
        if driver:
            with driver.session() as session:
                session.run("MATCH (r:Report {id: $rid}) DETACH DELETE r", {"rid": report_id})
            cleanup_orphans()
    except Exception:
        pass

    try:
        text = extract_text(doc.file_path, doc.mime_type)
        if text:
            doc.text_content = text
            db.commit()

            try:
                index_document(
                    document_id=doc.id,
                    text=text,
                    metadata={
                        "original_filename": doc.original_filename,
                        "mime_type": doc.mime_type,
                        "user_id": doc.user_id,
                    },
                )
            except Exception:
                pass

            try:
                entities = extract_entities_from_text(text)
                for ent in entities:
                    db.add(ExtractedEntity(
                        document_id=doc.id,
                        entity_type=ent.get("type", ""),
                        entity_value=ent.get("value", ""),
                        page_number=ent.get("page"),
                        confidence=ent.get("confidence"),
                    ))
                db.commit()

                if entities:
                    build_graph_from_entities(doc.id, doc.original_filename, entities)

                _resolve_asset_claims_for_document(doc.id, doc.original_filename, entities)
            except Exception:
                pass
    except Exception:
        pass

    return {"message": "Document reprocessed successfully", "document_id": doc.id}


@router.post("/replace/{document_id}", response_model=DocumentResponse)
def replace_document(
    document_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type '{file.content_type}' is not allowed",
        )

    if os.path.exists(doc.file_path):
        os.remove(doc.file_path)

    try:
        delete_document_chunks(doc.id)
    except Exception:
        pass

    db.query(ExtractedEntity).filter(ExtractedEntity.document_id == doc.id).delete()
    try:
        from app.services.graph_service import _get_driver, cleanup_orphans
        report_id = f"report_{doc.id}"
        driver = _get_driver()
        if driver:
            with driver.session() as session:
                session.run("MATCH (r:Report {id: $rid}) DETACH DELETE r", {"rid": report_id})
            cleanup_orphans()
    except Exception:
        pass

    ext = os.path.splitext(file.filename)[1] if file.filename else ""
    stored_name = f"{uuid.uuid4().hex}{ext}"
    now = datetime.now(timezone.utc)
    upload_dir = os.path.join(
        settings.UPLOAD_DIR,
        str(doc.user_id),
        str(now.year),
        f"{now.month:02d}",
        f"{now.day:02d}",
    )
    os.makedirs(upload_dir, exist_ok=True)
    new_path = os.path.join(upload_dir, stored_name)

    file_size = 0
    with open(new_path, "wb") as f:
        while chunk := file.file.read(1024 * 1024):
            file_size += len(chunk)
            f.write(chunk)

    doc.original_filename = file.filename or stored_name
    doc.stored_filename = stored_name
    doc.file_size = file_size
    doc.mime_type = file.content_type or "application/octet-stream"
    doc.file_path = new_path
    db.commit()
    db.refresh(doc)

    try:
        text = extract_text(doc.file_path, doc.mime_type)
        if text:
            doc.text_content = text
            db.commit()

            try:
                index_document(
                    document_id=doc.id,
                    text=text,
                    metadata={
                        "original_filename": doc.original_filename,
                        "mime_type": doc.mime_type,
                        "user_id": doc.user_id,
                    },
                )
            except Exception:
                pass

            try:
                entities = extract_entities_from_text(text)
                for ent in entities:
                    db.add(ExtractedEntity(
                        document_id=doc.id,
                        entity_type=ent.get("type", ""),
                        entity_value=ent.get("value", ""),
                        page_number=ent.get("page"),
                        confidence=ent.get("confidence"),
                    ))
                db.commit()
                if entities:
                    build_graph_from_entities(doc.id, doc.original_filename, entities)

                _resolve_asset_claims_for_document(doc.id, doc.original_filename, entities)
            except Exception:
                pass
    except Exception:
        pass

    return doc
