from sqlalchemy import Column, Integer, String, BigInteger, DateTime, ForeignKey, Text, func
from sqlalchemy.orm import relationship
from app.database import Base


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    original_filename = Column(String(500), nullable=False)
    stored_filename = Column(String(255), nullable=False, unique=True)
    file_size = Column(BigInteger, nullable=False)
    mime_type = Column(String(127), nullable=False)
    file_path = Column(String(1000), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    text_content = Column(Text, nullable=True)

    owner = relationship("User", backref="documents")
