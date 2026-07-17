from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models.user import User
from app.services.event_linking_service import (
    ingest_failure_history_csv,
    link_all_unmatched_documents,
    list_all_links,
    find_existing_links,
    get_all_failure_events,
)
from app.schemas.event_linking import (
    IngestFailuresResponse,
    RunLinkingResponse,
    EventLink,
    FailureEventResponse,
)

router = APIRouter(prefix="/event-linking", tags=["event-linking"])


@router.post("/ingest-failures", response_model=IngestFailuresResponse)
def ingest_failures(
    file: UploadFile = File(...),
    current_user: User = Depends(require_role("admin")),
):
    if file.content_type not in ("text/csv", "application/csv", "text/plain"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failure history must be a CSV file",
        )

    try:
        csv_text = file.file.read().decode("utf-8-sig")
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read CSV file.")
    if not csv_text.strip():
        raise HTTPException(status_code=400, detail="CSV file is empty.")

    count = ingest_failure_history_csv(csv_text)
    return IngestFailuresResponse(events_created=count)


@router.post("/run", response_model=RunLinkingResponse)
def run_linking(
    current_user: User = Depends(require_role("admin")),
):
    links = link_all_unmatched_documents()
    return RunLinkingResponse(
        links_created=len(links),
        links=[
            EventLink(
                document_id=0,
                failure_id=l["failure_id"],
                failure_type=l.get("failure_type", ""),
                failure_date=l.get("failure_date", ""),
                asset_id=l.get("asset_id", ""),
                confidence=l["confidence"],
            )
            for l in links
        ],
    )


@router.get("/results", response_model=list[EventLink])
def get_linking_results(
    current_user: User = Depends(get_current_user),
):
    links = list_all_links()
    return [
        EventLink(
            document_id=l.get("document_id", 0),
            document_filename=l.get("document_filename", ""),
            failure_id=l.get("failure_id", ""),
            failure_type=l.get("failure_type", ""),
            failure_date=l.get("failure_date", ""),
            asset_id=l.get("asset_id", ""),
            confidence=l.get("confidence", 0.0),
            linked_at=l.get("linked_at"),
        )
        for l in links
    ]


@router.get("/document/{document_id}", response_model=list[EventLink])
def get_document_links(
    document_id: int,
    current_user: User = Depends(get_current_user),
):
    links = find_existing_links(document_id)
    return [
        EventLink(
            document_id=document_id,
            failure_id=l.get("failure_id", ""),
            failure_type=l.get("failure_type", ""),
            failure_date=l.get("failure_date", ""),
            asset_id=l.get("asset_id", ""),
            confidence=l.get("confidence", 0.0),
        )
        for l in links
    ]


@router.get("/failures", response_model=list[FailureEventResponse])
def list_failure_events(
    current_user: User = Depends(get_current_user),
):
    events = get_all_failure_events()
    return [FailureEventResponse(**e) for e in events]
