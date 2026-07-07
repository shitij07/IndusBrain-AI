from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class DocumentResponse(BaseModel):
    id: int
    original_filename: str
    stored_filename: str
    file_size: int
    mime_type: str
    uploaded_at: Optional[datetime] = None
    user_id: int
    text_content: Optional[str] = None

    model_config = {"from_attributes": True}
