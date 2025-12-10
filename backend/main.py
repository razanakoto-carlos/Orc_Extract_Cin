from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
from pydantic import BaseModel
from database import SessionLocal, Document, get_db
from sqlalchemy.orm import Session
from fastapi import Depends
import base64
import json
import os
from typing import List
from sqlalchemy import desc
import cv2
import numpy as np
from datetime import datetime
from typing import Dict, Optional
from fastapi.staticfiles import StaticFiles

from dotenv import load_dotenv
load_dotenv()

# ============================================================================
# CONFIGURATION
# ============================================================================
app = FastAPI(
    title="OCR Document Extractor API",
    description="Extract text and structured data from documents",
    version="1.0.0"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Add this after creating your app, before the routes
app.mount("/images", StaticFiles(directory="images"), name="images")
# Environment Variables
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY environment variable is required")

# SINGLE IMAGES FOLDER - All photos saved here
IMAGES_FOLDER = "images"
os.makedirs(IMAGES_FOLDER, exist_ok=True)

# ============================================================================
# MODELS
# ============================================================================
class SaveRequest(BaseModel):
    data: Dict
    image_base64: str
    filename: Optional[str] = "document.jpg"

class OCRResponse(BaseModel):
    markdown: str
    data: Dict
    image_base64: str

# ============================================================================
# OCR PROMPT
# ============================================================================
OCR_PROMPT = """
Tu es un expert OCR spécialisé dans les documents malgaches (CIN, factures, reçus...).

Réponds **uniquement en français** avec :
1. D'abord un beau texte en Markdown bien structuré
2. Ensuite **obligatoirement** un bloc JSON complet comme ceci :

```json
{
  "type_document": "CIN Madagascar",
  "numero_cin": "112 203 601 234",
  "nom": "RAKOTO",
  "prenoms": "Jean Paul",
  "date_naissance": "15/03/1995",
  "lieu_naissance": "Antananarivo",
  "sexe": "M",
  "date_delivrance": "10/05/2023",
  "date_expiration": "10/05/2033",
  "adresse": "Lot IIY 45 Bis Ampasampito",
}
```

Le bloc ```json doit toujours exister, même si certaines données sont inconnues → mets "".
"""

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================
def parse_ocr_response(response: str) -> tuple[str, Dict]:
    """Parse OCR response into markdown and JSON data"""
    if "```json" in response:
        parts = response.split("```json")
        markdown_text = parts[0].strip()
        json_text = parts[1].split("```")[0].strip()
    else:
        markdown_text = response
        json_text = json.dumps({
            "type_document": "Document inconnu",
            "texte_brut": response
        })
    
    try:
        extracted_data = json.loads(json_text)
    except json.JSONDecodeError:
        extracted_data = {
            "type_document": "Erreur parsing",
            "texte_brut": response
        }
    
    return markdown_text, extracted_data

def generate_unique_filename(numero_cin: str = None) -> str:
    """Generate a unique filename for the photo"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    
    if numero_cin:
        # Clean the CIN number for filename
        clean_cin = numero_cin.replace(" ", "_").replace("/", "-")[:30]
        return f"photo_{clean_cin}_{timestamp}.jpg"
    else:
        return f"photo_{timestamp}.jpg"

def extract_face_photo(image_bytes: bytes) -> Optional[bytes]:
    """Extract face photo from CIN document image"""
    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return None
        
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        
        faces = face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(100, 100)
        )
        
        if len(faces) == 0:
            profile_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_profileface.xml')
            faces = profile_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(100, 100))
        
        if len(faces) > 0:
            faces = sorted(faces, key=lambda x: x[2] * x[3], reverse=True)
            x, y, w, h = faces[0]
            
            padding = int(w * 0.2)
            x = max(0, x - padding)
            y = max(0, y - padding)
            w = min(img.shape[1] - x, w + 2 * padding)
            h = min(img.shape[0] - y, h + 2 * padding)
            
            face_crop = img[y:y+h, x:x+w]
            
            success, encoded_image = cv2.imencode('.jpg', face_crop, [cv2.IMWRITE_JPEG_QUALITY, 90])
            if success:
                return encoded_image.tobytes()
        
        return None
        
    except Exception as e:
        print(f"Face extraction error: {str(e)}")
        return None

def detect_photo_region(image_bytes: bytes) -> Optional[bytes]:
    """Alternative method: Look for photo region based on common CIN layout"""
    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return None
        
        height, width = img.shape[:2]
        
        photo_width = width // 3
        photo_x = width - photo_width
        
        photo_height = int(height * 0.66)
        photo_y = (height - photo_height) // 2
        
        photo_region = img[photo_y:photo_y+photo_height, photo_x:photo_x+photo_width]
        
        gray = cv2.cvtColor(photo_region, cv2.COLOR_BGR2GRAY)
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(80, 80))
        
        if len(faces) > 0:
            x, y, w, h = faces[0]
            padding = int(w * 0.3)
            x = max(0, x - padding)
            y = max(0, y - padding)
            w = min(photo_region.shape[1] - x, w + 2 * padding)
            h = min(photo_region.shape[0] - y, h + 2 * padding)
            
            face_crop = photo_region[y:y+h, x:x+w]
            success, encoded_image = cv2.imencode('.jpg', face_crop, [cv2.IMWRITE_JPEG_QUALITY, 90])
            if success:
                return encoded_image.tobytes()
        
        success, encoded_image = cv2.imencode('.jpg', photo_region, [cv2.IMWRITE_JPEG_QUALITY, 90])
        if success:
            return encoded_image.tobytes()
            
        return None
        
    except Exception as e:
        print(f"Photo region detection error: {str(e)}")
        return None

# ============================================================================
# API ENDPOINTS
# ============================================================================
@app.get("/")
async def root():
    """Health check endpoint"""
    try:
        db = SessionLocal()
        total_docs = db.query(Document).count()
        db.close()
    except:
        total_docs = 0
    
    try:
        total_photos = len([f for f in os.listdir(IMAGES_FOLDER) if f.endswith('.jpg')])
    except:
        total_photos = 0
    
    return {
        "status": "running",
        "service": "OCR Document Extractor",
        "version": "1.0.0",
        "total_documents": total_docs,
        "total_photos": total_photos,
        "images_folder": IMAGES_FOLDER
    }

@app.post("/ocr", response_model=OCRResponse)
async def extract_ocr(file: UploadFile = File(...)):
    """Extract text and structured data from uploaded image"""
    allowed_types = ["image/png", "image/jpeg", "image/jpg", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(allowed_types)}"
        )
    
    try:
        image_bytes = await file.read()
        base64_image = base64.b64encode(image_bytes).decode("utf-8")
        
        client = Groq(api_key=GROQ_API_KEY)
        
        chat_completion = client.chat.completions.create(
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": OCR_PROMPT},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}
                    },
                ],
            }],
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            temperature=0.2,
            max_tokens=2048,
        )
        
        response = chat_completion.choices[0].message.content
        markdown_text, extracted_data = parse_ocr_response(response)
        
        return OCRResponse(
            markdown=markdown_text,
            data=extracted_data,
            image_base64=base64_image
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR extraction failed: {str(e)}")

@app.post("/extract-photo")
async def extract_photo(file: UploadFile = File(...)):
    """Extract face photo from CIN document"""
    allowed_types = ["image/png", "image/jpeg", "image/jpg", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(allowed_types)}"
        )
    
    try:
        image_bytes = await file.read()
        
        face_photo = extract_face_photo(image_bytes)
        
        if face_photo is None:
            face_photo = detect_photo_region(image_bytes)
        
        if face_photo is None:
            raise HTTPException(
                status_code=404,
                detail="No face photo found in the document"
            )
        
        face_base64 = base64.b64encode(face_photo).decode("utf-8")
        
        return {
            "success": True,
            "message": "Face photo extracted successfully",
            "photo_base64": face_base64,
            "photo_size": len(face_photo)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Photo extraction failed: {str(e)}")

@app.post("/save")
async def save_document(
    request: SaveRequest,
    db: Session = Depends(get_db)
):
    """
    Save extracted document - All photos go to single 'images' folder
    """
    try:
        # Skip if this is a verso-only save request (from old frontend code)
        if request.data.get("is_verso_image") and request.data.get("side") == "verso":
            return {
                "success": True,
                "message": "Verso image skipped (data already saved with recto)"
            }
        
        # Check if document already exists (prevent duplicates)
        numero_cin = request.data.get("numero_cin", "")
        if numero_cin:
            existing = db.query(Document).filter(Document.numero_cin == numero_cin).first()
            if existing:
                return {
                    "success": True,
                    "message": "Document already exists in database",
                    "database_id": existing.id,
                    "existing_photo": existing.photo_visage_path
                }
        
        # Generate unique photo filename
        photo_filename = generate_unique_filename(numero_cin)
        photo_path = os.path.join(IMAGES_FOLDER, photo_filename)
        
        # Extract and save ONLY the face photo to images folder
        has_face_photo = False
        
        try:
            image_bytes = base64.b64decode(request.image_base64)
            face_photo = extract_face_photo(image_bytes)
            
            # Try region-based detection if face detection fails
            if face_photo is None:
                face_photo = detect_photo_region(image_bytes)
            
            if face_photo:
                with open(photo_path, "wb") as f:
                    f.write(face_photo)
                has_face_photo = True
                print(f"✅ Face photo saved to: {photo_path}")
        except Exception as e:
            print(f"⚠️ Warning: Could not extract face photo: {str(e)}")
            photo_path = None
        
        # Save to database - store relative path
        db_document = Document(
            folder_name=photo_filename,  # Store filename instead of folder
            type_document=request.data.get("type_document", ""),
            numero_cin=request.data.get("numero_cin", ""),
            nom=request.data.get("nom", ""),
            prenoms=request.data.get("prenoms", ""),
            date_naissance=request.data.get("date_naissance", ""),
            lieu_naissance=request.data.get("lieu_naissance", ""),
            sexe=request.data.get("sexe", ""),
            date_delivrance=request.data.get("date_delivrance", ""),
            date_expiration=request.data.get("date_expiration", ""),
            adresse=request.data.get("adresse", ""),
            photo_visage_path=photo_path,
            has_face_photo=has_face_photo,
            date_sauvegarde=datetime.now()
        )
        
        db.add(db_document)
        db.commit()
        db.refresh(db_document)
        
        response = {
            "success": True,
            "database_id": db_document.id,
            "message": "Document sauvegardé avec succès!",
            "images_folder": IMAGES_FOLDER,
            "files": {}
        }
        
        if photo_path:
            response["files"]["photo_visage"] = photo_path
        
        return response
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"❌ SAVE ERROR: {str(e)}")
        print(f"TRACEBACK:\n{error_details}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Save failed: {str(e)}")

# ============================================================================
# DATABASE QUERY ENDPOINTS
# ============================================================================
class DocumentResponse(BaseModel):
    id: int
    folder_name: str
    type_document: str
    numero_cin: str
    nom: str
    prenoms: str
    date_naissance: str
    lieu_naissance: str
    sexe: str
    date_delivrance: str
    date_expiration: str
    adresse: str
    photo_visage_path: Optional[str]
    has_face_photo: bool
    date_sauvegarde: datetime
    
    class Config:
        # orm_mode = True
        from_attributes = True 

@app.get("/documents/db", response_model=List[DocumentResponse])
async def list_documents_db(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """List all documents from database"""
    documents = db.query(Document)\
        .order_by(desc(Document.date_sauvegarde))\
        .offset(skip)\
        .limit(limit)\
        .all()
    return documents

@app.get("/documents/db/{document_id}", response_model=DocumentResponse)
async def get_document_by_id(
    document_id: int,
    db: Session = Depends(get_db)
):
    """Get a specific document by ID"""
    document = db.query(Document).filter(Document.id == document_id).first()
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return document

@app.get("/documents/db/search/{numero_cin}")
async def search_by_cin(
    numero_cin: str,
    db: Session = Depends(get_db)
):
    """Search documents by CIN number"""
    documents = db.query(Document)\
        .filter(Document.numero_cin.like(f"%{numero_cin}%"))\
        .order_by(desc(Document.date_sauvegarde))\
        .all()
    
    if not documents:
        raise HTTPException(status_code=404, detail="No documents found")
    
    return {
        "count": len(documents),
        "documents": documents
    }

@app.delete("/documents/db/{document_id}")
async def delete_document(
    document_id: int,
    db: Session = Depends(get_db)
):
    """Delete a document from database and its photo from images folder"""
    document = db.query(Document).filter(Document.id == document_id).first()
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Delete photo from images folder if it exists
    if document.photo_visage_path and os.path.exists(document.photo_visage_path):
        try:
            os.remove(document.photo_visage_path)
            print(f"✅ Deleted photo: {document.photo_visage_path}")
        except Exception as e:
            print(f"⚠️ Warning: Could not delete photo: {str(e)}")
    
    db.delete(document)
    db.commit()
    
    return {
        "success": True,
        "message": f"Document {document_id} deleted",
        "deleted_id": document_id
    }

# ============================================================================
# RUN SERVER
# ============================================================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )