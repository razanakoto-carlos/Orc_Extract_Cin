# deepface_service.py
from deepface import DeepFace
import numpy as np
import cv2
import os
from typing import List, Dict, Tuple, Optional
import base64
from datetime import datetime

class FaceSearchService:
    def __init__(self, images_folder: str = "images"):
        self.images_folder = images_folder
        self.supported_extensions = ('.jpg', '.jpeg', '.png', '.webp')
        
    def extract_face_embedding(self, image_path: str) -> Optional[np.ndarray]:
        """
        Extract face embedding from an image
        """
        try:
            # Try to find a face in the image
            result = DeepFace.represent(
                img_path=image_path,
                model_name='Facenet',
                enforce_detection=False,  # Changed to False to be more lenient
                detector_backend='opencv',
                align=True
            )
            
            if result and len(result) > 0:
                return np.array(result[0]['embedding'])
            return None
            
        except Exception as e:
            print(f"Embedding extraction failed for {image_path}: {str(e)}")
            return None
    
    def extract_embedding_from_bytes(self, image_bytes: bytes) -> Optional[np.ndarray]:
        """
        Extract face embedding from image bytes
        """
        try:
            # Save temp file
            temp_path = f"temp_{datetime.now().timestamp()}.jpg"
            with open(temp_path, 'wb') as f:
                f.write(image_bytes)
            
            embedding = self.extract_face_embedding(temp_path)
            
            # Clean up temp file
            if os.path.exists(temp_path):
                os.remove(temp_path)
                
            return embedding
            
        except Exception as e:
            print(f"Embedding extraction from bytes failed: {str(e)}")
            return None
    
    def compare_faces(self, embedding1: np.ndarray, embedding2: np.ndarray) -> float:
        """
        Compare two face embeddings and return similarity score (0-1)
        """
        try:
            # Cosine similarity
            similarity = np.dot(embedding1, embedding2) / (np.linalg.norm(embedding1) * np.linalg.norm(embedding2))
            
            # Convert to 0-100% scale
            normalized_similarity = (similarity + 1) / 2
            
            return float(normalized_similarity)
        except Exception as e:
            print(f"Comparison error: {str(e)}")
            return 0.0
    
    def search_similar_faces(self, 
                            query_embedding: np.ndarray, 
                            database_embeddings: Dict[int, np.ndarray],
                            threshold: float = 0.4,
                            top_k: int = 10) -> List[Dict]:
        """
        Search for similar faces in database
        """
        results = []
        
        for doc_id, db_embedding in database_embeddings.items():
            if db_embedding is not None:
                similarity = self.compare_faces(query_embedding, db_embedding)
                
                if similarity >= threshold:
                    results.append({
                        'document_id': doc_id,
                        'similarity': similarity,
                        'score_percentage': similarity * 100
                    })
        
        # Sort by similarity (descending)
        results.sort(key=lambda x: x['similarity'], reverse=True)
        
        # Return top K results
        return results[:top_k]
    
    def load_database_embeddings(self, documents: List[Dict]) -> Dict[int, np.ndarray]:
        """
        Load or create embeddings for all documents with photos
        """
        embeddings = {}
        
        for doc in documents:
            doc_id = doc.get('id')
            photo_path = doc.get('photo_visage_path')
            has_face_photo = doc.get('has_face_photo', False)
            
            if has_face_photo and photo_path and os.path.exists(photo_path):
                # Try to load existing embedding or create new one
                embedding = self.load_or_create_embedding(doc_id, photo_path)
                if embedding is not None:
                    embeddings[doc_id] = embedding
        
        return embeddings
    
    def load_or_create_embedding(self, doc_id: int, photo_path: str) -> Optional[np.ndarray]:
        """
        Load embedding from cache or create new one
        """
        cache_dir = "face_embeddings"
        os.makedirs(cache_dir, exist_ok=True)
        cache_path = os.path.join(cache_dir, f"{doc_id}.npy")
        
        # Try to load from cache
        if os.path.exists(cache_path):
            try:
                embedding = np.load(cache_path)
                print(f"Loaded cached embedding for document {doc_id}")
                return embedding
            except Exception as e:
                print(f"Failed to load cached embedding for {doc_id}: {str(e)}")
        
        # Create new embedding
        embedding = self.extract_face_embedding(photo_path)
        if embedding is not None:
            # Save to cache
            np.save(cache_path, embedding)
            print(f"Created and cached embedding for document {doc_id}")
        
        return embedding
    
    def clear_cache_for_document(self, doc_id: int):
        """
        Clear cached embedding for a document
        """
        cache_path = os.path.join("face_embeddings", f"{doc_id}.npy")
        if os.path.exists(cache_path):
            os.remove(cache_path)
            print(f"Cleared cache for document {doc_id}")

# Singleton instance
face_search_service = FaceSearchService()