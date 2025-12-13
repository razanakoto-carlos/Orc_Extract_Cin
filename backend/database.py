# database.py
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os

# SQLite database URL
SQLALCHEMY_DATABASE_URL = "sqlite:///./documents.db"

# Create engine
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Define Document model - SIMPLIFIED
class Document(Base):
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True, index=True)
    folder_name = Column(String(255), unique=True, index=True)
    
    # Core fields
    type_document = Column(String(100))
    numero_cin = Column(String(50), index=True)
    nom = Column(String(100))
    prenoms = Column(String(100))
    date_naissance = Column(String(20))
    lieu_naissance = Column(String(100))
    sexe = Column(String(1))
    date_delivrance = Column(String(20))
    date_expiration = Column(String(20))
    adresse = Column(Text)
    
    # Image paths - ONLY FACE PHOTO
    photo_visage_path = Column(String(255), nullable=True)
    has_face_photo = Column(Boolean, default=False)
    
    # Metadata
    date_sauvegarde = Column(DateTime, default=datetime.now)

# Create tables
Base.metadata.create_all(bind=engine)

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()