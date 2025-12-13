# clean_embeddings.py
import os
import numpy as np
from deepface_service import FaceSearchService

def clean_and_rebuild_embeddings():
    """Clean all cached embeddings and rebuild them"""
    service = FaceSearchService()
    
    cache_dir = "face_embeddings"
    
    # Delete all cached embeddings
    if os.path.exists(cache_dir):
        for file in os.listdir(cache_dir):
            if file.endswith('.npy'):
                os.remove(os.path.join(cache_dir, file))
        print(f"🧹 Deleted all cached embeddings")
    
    # You'll need to rebuild embeddings next time you search
    print("✅ Cache cleared. Embeddings will be rebuilt on next search.")

if __name__ == "__main__":
    clean_and_rebuild_embeddings()