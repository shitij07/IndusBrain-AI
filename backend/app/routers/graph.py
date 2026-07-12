from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.document import Document
from app.services.graph_service import get_full_graph, get_graph_by_document

router = APIRouter(prefix="/graph", tags=["graph"])


@router.get("")
def get_graph(
    current_user: User = Depends(get_current_user),
):
    data = get_full_graph()
    return data


@router.get("/document/{document_id}")
def get_document_graph(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    data = get_graph_by_document(document_id)
    return data
