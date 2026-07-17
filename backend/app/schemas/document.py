from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class DuplicateInfo(BaseModel):
    duplicate_of_id: int
    match_type: str
    confidence: float


class DocumentResponse(BaseModel):
    id: int
    original_filename: str
    stored_filename: str
    file_size: int
    mime_type: str
    uploaded_at: Optional[datetime] = None
    user_id: int
    text_content: Optional[str] = None
    content_hash: Optional[str] = None
    duplicate_of_id: Optional[int] = None

    model_config = {"from_attributes": True}
