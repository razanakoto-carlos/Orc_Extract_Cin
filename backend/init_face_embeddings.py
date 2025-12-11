# init_face_embeddings.py
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, Document
from deepface_service import face_search_service

def initialize_embeddings():
    """Initialize face embeddings for all existing documents"""
    db = SessionLocal()
    
    try:
        # Get all documents with face photos
        documents = db.query(Document).filter(Document.has_face_photo == True).all()
        
        print(f"Found {len(documents)} documents with face photos")
        
        for doc in documents:
            print(f"Processing document {doc.id}: {doc.nom} {doc.prenoms}")
            
            if doc.photo_visage_path and os.path.exists(doc.photo_visage_path):
                embedding = face_search_service.load_or_create_embedding(doc.id, doc.photo_visage_path)
                if embedding is not None:
                    print(f"  ✓ Embedding created/cached")
                else:
                    print(f"  ✗ No face detected")
            else:
                print(f"  ✗ Photo not found")
        
        print("\n✅ Embeddings initialization complete!")
        
    except Exception as e:
        print(f"Error: {str(e)}")
    finally:
        db.close()

if __name__ == "__main__":
    initialize_embeddings()