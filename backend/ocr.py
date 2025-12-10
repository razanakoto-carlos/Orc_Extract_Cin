from groq import Groq
import base64
import json
import os
from typing import Dict, Any, Tuple
from pathlib import Path
from datetime import datetime


class OCRExtractor:
    """Extracteur OCR utilisant Groq Vision AI"""
    
    def __init__(self, api_key: str):
        """
        Initialise l'extracteur OCR avec la clé API Groq
        
        Args:
            api_key: Clé API Groq
        """
        self.client = Groq(api_key=api_key)
        self.model = "meta-llama/llama-4-scout-17b-16e-instruct"
        
    def process_image(self, image_bytes: bytes) -> Tuple[Dict[str, Any], str]:
        """
        Traite une image et retourne les données extraites et le markdown
        
        Args:
            image_bytes: Bytes de l'image
            
        Returns:
            Tuple (données JSON, texte markdown)
        """
        try:
            base64_image = base64.b64encode(image_bytes).decode("utf-8")
            
            prompt = """
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
  "texte_brut": "tout le texte extrait de l'image..."
}
```

Le bloc ```json doit toujours exister, même si certaines données sont inconnues → mets "".
"""
            
            chat_completion = self.client.chat.completions.create(
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}},
                    ],
                }],
                model=self.model,
                temperature=0.2,
                max_tokens=2048,
            )
            
            response = chat_completion.choices[0].message.content
            extracted_data = self._parse_response(response)
            
            # Extraire le markdown (partie avant le JSON)
            if "```json" in response:
                markdown = response.split("```json")[0].strip()
            else:
                markdown = response
            
            return extracted_data, markdown
            
        except Exception as e:
            raise Exception(f"Erreur lors du traitement OCR: {str(e)}")
    
    def _parse_response(self, response: str) -> Dict[str, Any]:
        """
        Parse la réponse de l'API pour extraire le JSON
        
        Args:
            response: Réponse complète de l'API
            
        Returns:
            Dictionnaire des données extraites
        """
        try:
            if "```json" in response:
                parts = response.split("```json")
                json_text = parts[1].split("```")[0].strip()
            else:
                # Fallback si pas de format JSON trouvé
                json_text = json.dumps({
                    "type_document": "Document inconnu",
                    "texte_brut": response[:500]
                })
            
            extracted_data = json.loads(json_text)
            return extracted_data
            
        except json.JSONDecodeError as e:
            return {
                "type_document": "Erreur parsing JSON",
                "texte_brut": response[:500],
                "erreur": str(e)
            }
        except Exception as e:
            return {
                "type_document": "Erreur inattendue",
                "erreur": str(e)
            }


class DocumentStorage:
    """Gestion du stockage des documents"""
    
    def __init__(self, save_root: str = "documents_sauvegardes"):
        """
        Initialise le gestionnaire de stockage
        
        Args:
            save_root: Dossier racine pour la sauvegarde
        """
        self.save_root = Path(save_root)
        self.save_root.mkdir(exist_ok=True)
    
    def save_document(self, data: Dict[str, Any], image_base64: str, filename: str) -> str:
        """
        Sauvegarde un document traité
        
        Args:
            data: Données extraites
            image_base64: Image encodée en base64
            filename: Nom du fichier original
            
        Returns:
            Chemin du dossier créé
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        doc_type = str(data.get("type_document", "Document")).replace(" ", "_")
        doc_id = str(data.get("numero_cin", data.get("numero", "unknown"))).replace(" ", "_")[:30]
        
        folder_name = f"{timestamp}_{doc_type}_{doc_id}"
        folder_path = self.save_root / folder_name
        folder_path.mkdir(parents=True, exist_ok=True)
        
        # Sauvegarde image
        image_bytes = base64.b64decode(image_base64)
        image_path = folder_path / "image_originale.jpg"
        with open(image_path, "wb") as f:
            f.write(image_bytes)
        
        # Préparation des métadonnées
        metadata = {
            "dossier": str(folder_path),
            "image_path": str(image_path),
            "fichier_original": filename,
            "date_sauvegarde": datetime.now().isoformat(),
            **data
        }
        
        # Sauvegarde JSON
        json_path = folder_path / "document.json"
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)
        
        return str(folder_path)
    
    def list_documents(self) -> list:
        """
        Liste tous les documents sauvegardés
        
        Returns:
            Liste des documents avec métadonnées
        """
        documents = []
        for folder in self.save_root.iterdir():
            if folder.is_dir():
                json_file = folder / "document.json"
                if json_file.exists():
                    try:
                        with open(json_file, "r", encoding="utf-8") as f:
                            doc_data = json.load(f)
                            documents.append({
                                "folder": folder.name,
                                "type": doc_data.get("type_document", "Unknown"),
                                "date": doc_data.get("date_sauvegarde", ""),
                                "path": str(folder),
                                "data": doc_data
                            })
                    except Exception:
                        continue
        
        # Trier par date (plus récent en premier)
        documents.sort(key=lambda x: x.get("date", ""), reverse=True)
        return documents