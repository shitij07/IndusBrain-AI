from pydantic import BaseModel
from typing import Optional


class FailureEventResponse(BaseModel):
    id: str
    failure_type: str = ""
    root_cause: str = ""
    downtime: str = ""
    corrective_action: str = ""
    asset_id: str = ""
    equipment: str = ""
    date: str = ""
    technician: str = ""
    status: str = ""
    related_sop: str = ""


class EventLink(BaseModel):
    document_id: int
    document_filename: str = ""
    failure_id: str
    failure_type: str = ""
    failure_date: str = ""
    asset_id: str = ""
    confidence: float = 0.0
    linked_at: Optional[str] = None


class LinkDocumentResponse(BaseModel):
    document_id: int
    links: list[EventLink] = []


class IngestFailuresResponse(BaseModel):
    events_created: int


class RunLinkingResponse(BaseModel):
    links_created: int
    links: list[EventLink] = []
