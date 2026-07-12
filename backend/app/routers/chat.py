from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.chat_message import ChatMessage
from app.schemas.chat import ChatRequest, ChatResponse, SourceInfo
from app.schemas.chat_message import ChatMessageResponse
from app.services.chroma_service import query_similar, generate_answer

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
def chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    db.add(ChatMessage(user_id=current_user.id, role="user", content=request.question))
    db.commit()

    try:
        results = query_similar(
            query=request.question,
            top_k=5,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

    if not results:
        answer = "I couldn't find any relevant information in your documents to answer that question. Please upload relevant documents first or try rephrasing your question."
        db.add(ChatMessage(user_id=current_user.id, role="assistant", content=answer))
        db.commit()
        return ChatResponse(answer=answer, sources=[])

    try:
        result = generate_answer(question=request.question, context_chunks=results)
    except Exception as e:
        err = str(e)
        if "RESOURCE_EXHAUSTED" in err or "quota" in err.lower() or "429" in err:
            answer = "I'm currently rate-limited by the AI service. Please wait a moment and try again."
            db.add(ChatMessage(user_id=current_user.id, role="assistant", content=answer))
            db.commit()
            return ChatResponse(answer=answer, sources=[])
        raise HTTPException(status_code=500, detail=f"Answer generation failed: {str(e)}")

    db.add(ChatMessage(user_id=current_user.id, role="assistant", content=result["answer"]))
    db.commit()

    sources = [
        SourceInfo(
            source=s["source"],
            pages=s.get("pages"),
            chunk_index=s["chunk_index"],
            total_chunks=s["total_chunks"],
            document_id=s["document_id"],
            distance=s.get("distance"),
        )
        for s in result["sources"]
    ]

    return ChatResponse(answer=result["answer"], sources=sources)


@router.get("/history", response_model=list[ChatMessageResponse])
def get_chat_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == current_user.id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )


@router.delete("/history", status_code=204)
def clear_chat_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db.query(ChatMessage).filter(ChatMessage.user_id == current_user.id).delete()
    db.commit()