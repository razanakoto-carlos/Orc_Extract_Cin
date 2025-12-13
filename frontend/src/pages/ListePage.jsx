import { useState, useEffect, useRef } from "react";
import axios from "axios";

const API_URL = "http://localhost:8000";

export default function ListePage() {
  const [documents, setDocuments] = useState([]);
  const [filteredDocuments, setFilteredDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Photo Search States
  const [photoSearchMode, setPhotoSearchMode] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoSearchResults, setPhotoSearchResults] = useState([]);
  const [photoSearchLoading, setPhotoSearchLoading] = useState(false);
  const fileInputRef = useRef(null);

  // Fetch documents on component mount
  useEffect(() => {
    fetchDocuments();
  }, []);

  // Filter documents when search term changes
  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredDocuments(documents);
    } else {
      const filtered = documents.filter(
        (doc) =>
          doc.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          doc.prenoms?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          doc.numero_cin?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredDocuments(filtered);
    }
  }, [searchTerm, documents]);

  const fetchDocuments = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await axios.get(`${API_URL}/documents/db`);
      setDocuments(response.data);
      setFilteredDocuments(response.data);
    } catch (err) {
      setError(
        err.response?.data?.detail || "Erreur lors du chargement des documents"
      );
      console.error("Erreur chargement:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleViewDetails = async (documentId) => {
    try {
      const response = await axios.get(`${API_URL}/documents/db/${documentId}`);
      setSelectedDocument(response.data);
      setShowDetails(true);
    } catch (err) {
      setError(
        err.response?.data?.detail || "Erreur lors du chargement des détails"
      );
    }
  };

  const handleSearchByCIN = async () => {
    if (!searchTerm.trim()) {
      fetchDocuments();
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(
        `${API_URL}/documents/db/search/${searchTerm}`
      );
      setFilteredDocuments(response.data.documents);
    } catch (err) {
      if (err.response?.status === 404) {
        setFilteredDocuments([]);
      } else {
        setError(err.response?.data?.detail || "Erreur lors de la recherche");
      }
    } finally {
      setLoading(false);
    }
  };

  // Photo Search Functions
  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Veuillez sélectionner un fichier image");
      return;
    }

    setPhotoFile(file);
    setPhotoSearchResults([]);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoSearch = async () => {
    if (!photoFile) {
      setError("Veuillez sélectionner une photo");
      return;
    }

    setPhotoSearchLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", photoFile);

      const response = await axios.post(
        `${API_URL}/face/search?threshold=0.65&top_k=10`, // 0.65 = 65%
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setPhotoSearchResults(response.data.matches);

      // Highlight matching documents in the list
      const matchingIds = response.data.matches.map(
        (match) => match.document_id
      );
      const allDocs = documents.map((doc) => ({
        ...doc,
        isMatch: matchingIds.includes(doc.id),
      }));

      setFilteredDocuments(allDocs.filter((doc) => doc.isMatch));
    } catch (err) {
      setError(
        err.response?.data?.detail || "Erreur lors de la recherche par photo"
      );
      console.error("Photo search error:", err);
    } finally {
      setPhotoSearchLoading(false);
    }
  };

  const resetPhotoSearch = () => {
    setPhotoSearchMode(false);
    setPhotoFile(null);
    setPhotoPreview(null);
    setPhotoSearchResults([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    fetchDocuments();
  };

  const handleDeleteDocument = async (documentId) => {
    setDeleting(true);
    try {
      await axios.delete(`${API_URL}/documents/db/${documentId}`);

      // Update local state
      setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
      setFilteredDocuments((prev) =>
        prev.filter((doc) => doc.id !== documentId)
      );

      // Close modal if deleting the selected document
      if (selectedDocument?.id === documentId) {
        handleCloseDetails();
      }

      setError("");
      setDeleteConfirm(null);
    } catch (err) {
      setError(err.response?.data?.detail || "Erreur lors de la suppression");
    } finally {
      setDeleting(false);
    }
  };

  const handleCloseDetails = () => {
    setShowDetails(false);
    setSelectedDocument(null);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      if (typeof dateString === "string") {
        const date = new Date(dateString);
        return date.toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
      }
      return dateString;
    } catch {
      return dateString || "N/A";
    }
  };

  const getDocumentStatus = (dateExpiration) => {
    if (!dateExpiration) return { label: "Inconnu", color: "gray" };

    try {
      const today = new Date();
      const expDate = new Date(dateExpiration);
      const diffTime = expDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        return { label: "Expiré", color: "red" };
      } else if (diffDays < 30) {
        return { label: "Expire bientôt", color: "orange" };
      } else {
        return { label: "Valide", color: "green" };
      }
    } catch {
      return { label: "Inconnu", color: "gray" };
    }
  };

  // Function to get photo URL
  const getPhotoUrl = (photoPath) => {
    if (!photoPath) return null;

    // If it's a relative path, construct the full URL
    if (photoPath.startsWith("images/") || !photoPath.includes("http")) {
      return `${API_URL}/${photoPath}`;
    }

    return photoPath;
  };

  if (loading && documents.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F1FAFF] to-[#CBE4FF] p-6">
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement des documents...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F1FAFF] to-[#CBE4FF] p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              📋 Liste des Documents
            </h1>
            <p className="text-gray-600">
              {documents.length} document{documents.length !== 1 ? "s" : ""}{" "}
              enregistré{documents.length !== 1 ? "s" : ""}
              {searchTerm && filteredDocuments.length !== documents.length && (
                <span className="ml-2 text-blue-600">
                  ({filteredDocuments.length} résultat
                  {filteredDocuments.length !== 1 ? "s" : ""} trouvé
                  {filteredDocuments.length !== 1 ? "s" : ""})
                </span>
              )}
            </p>
          </div>

          {/* Photo Search Button */}
          <button
            onClick={() => setPhotoSearchMode(!photoSearchMode)}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-purple-500 text-white font-semibold py-2 px-6 rounded-lg hover:from-purple-700 hover:to-purple-600 transition-all"
          >
            <span>🔍</span>
            {photoSearchMode ? "Recherche par Texte" : "Recherche par Photo"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between shadow-sm">
            <span>{error}</span>
            <button
              onClick={() => setError("")}
              className="text-red-600 hover:text-red-800 font-bold"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Photo Search Area */}
      {photoSearchMode && (
        <div className="mb-8 bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            🔍 Recherche par Photo
          </h2>
          <div className="flex flex-col md:flex-row gap-6 items-center">
            {/* Photo Preview */}
            <div className="flex-1">
              {photoPreview ? (
                <div className="border-2 border-gray-200 rounded-xl p-4">
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="max-h-64 mx-auto rounded-lg shadow-md"
                  />
                  <p className="text-center text-sm text-gray-500 mt-2">
                    Photo sélectionnée
                  </p>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors">
                  <div className="text-6xl mb-4">📸</div>
                  <p className="text-gray-500 mb-4">
                    Sélectionnez une photo de visage pour rechercher
                  </p>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handlePhotoUpload}
                    accept="image/*"
                    className="hidden"
                    id="photo-upload"
                  />
                  <label
                    htmlFor="photo-upload"
                    className="cursor-pointer bg-gradient-to-r from-blue-600 to-blue-500 text-white font-medium py-2 px-6 rounded-lg hover:from-blue-700 hover:to-blue-600 transition-all inline-block"
                  >
                    Choisir une photo
                  </label>
                </div>
              )}
            </div>

            {/* Search Controls */}
            <div className="flex-1 space-y-4">
              <div>
                <h3 className="font-medium text-gray-700 mb-2">
                  Comment ça marche ?
                </h3>
                <ul className="text-sm text-gray-600 space-y-1 list-disc pl-5">
                  <li>Téléchargez une photo de visage</li>
                  <li>
                    Le système compare avec toutes les photos dans la base de
                    données
                  </li>
                  <li>Les résultats sont triés par similarité</li>
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handlePhotoSearch}
                  disabled={!photoFile || photoSearchLoading}
                  className="flex-1 bg-gradient-to-r from-green-600 to-green-500 text-white font-semibold py-3 px-4 rounded-lg hover:from-green-700 hover:to-green-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {photoSearchLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Recherche en cours...
                    </>
                  ) : (
                    "Lancer la recherche"
                  )}
                </button>
                <button
                  onClick={resetPhotoSearch}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
              </div>

              {/* Search Results Summary */}
              {photoSearchResults.length > 0 && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-blue-800">
                        {photoSearchResults.length} correspondance
                        {photoSearchResults.length !== 1 ? "s" : ""} trouvée
                        {photoSearchResults.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <button
                      onClick={() => setPhotoSearchResults([])}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Effacer
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Text Search Bar (only show when not in photo search mode) */}
      {!photoSearchMode && (
        <div className="mb-8">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearch}
              onKeyPress={(e) => e.key === "Enter" && handleSearchByCIN()}
              placeholder="Rechercher par nom, prénom, numéro CIN..."
              className="w-full px-4 py-3 pl-12 bg-white border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex gap-2">
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
              <button
                onClick={handleSearchByCIN}
                className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-4 py-1 rounded-lg hover:from-blue-700 hover:to-blue-600 text-sm"
              >
                Rechercher
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Documents Grid - WITH ACTUAL PHOTOS */}
      {filteredDocuments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredDocuments.map((doc) => {
            const status = getDocumentStatus(doc.date_expiration);
            const photoMatch = photoSearchResults.find(
              (result) => result.document_id === doc.id
            );
            const photoUrl = getPhotoUrl(doc.photo_visage_path);

            return (
              <div
                key={doc.id}
                className={`bg-white rounded-xl shadow-md border overflow-hidden hover:shadow-lg transition-shadow duration-300 ${
                  photoMatch ? "border-2 border-green-400" : "border-gray-100"
                } ${photoMatch ? "ring-2 ring-green-200" : ""}`}
              >
                {/* Face Photo - SHOW ACTUAL PHOTO */}
                <div className="h-48 bg-gradient-to-br from-blue-50 to-gray-50 flex items-center justify-center relative overflow-hidden">
                  {doc.has_face_photo && photoUrl ? (
                    <div className="relative w-full h-full flex items-center justify-center">
                      <div className="w-40 h-40 rounded-full border-4 border-white shadow-lg overflow-hidden">
                        <img
                          src={photoUrl}
                          alt={`${doc.nom} ${doc.prenoms}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // If image fails to load, show fallback
                            e.target.style.display = "none";
                            e.target.parentElement.innerHTML = `
                              <div class="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                                <span class="text-4xl">👤</span>
                              </div>
                            `;
                          }}
                        />
                      </div>
                      {photoMatch && (
                        <div className="absolute top-2 right-2 bg-gradient-to-r from-green-600 to-green-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
                          {photoMatch.similarity.toFixed(0)}% match
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="w-40 h-40 rounded-full border-4 border-gray-200 flex items-center justify-center text-4xl text-gray-400 bg-gray-100">
                        👤
                      </div>
                      {!doc.has_face_photo && (
                        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">
                          Pas de photo
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Info Section */}
                <div className="p-4">
                  {/* Name */}
                  <h3 className="font-bold text-gray-800 text-lg truncate mb-1">
                    {doc.nom} {doc.prenoms}
                  </h3>

                  {/* CIN Number */}
                  <div className="mb-3">
                    <div className="text-xs text-gray-500 mb-1">N° CIN</div>
                    <div className="font-mono font-bold text-gray-700 text-sm">
                      {doc.numero_cin || "N/A"}
                    </div>
                  </div>

                  {/* Status & Actions */}
                  <div className="flex items-center justify-between mt-4">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        status.color === "green"
                          ? "bg-green-100 text-green-800"
                          : status.color === "orange"
                          ? "bg-orange-100 text-orange-800"
                          : status.color === "red"
                          ? "bg-red-100 text-red-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {status.label}
                    </span>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleViewDetails(doc.id)}
                        className="bg-gradient-to-r from-blue-600 to-blue-500 text-white text-sm font-medium py-1 px-3 rounded-lg hover:from-blue-700 hover:to-blue-600 transition-all"
                      >
                        Détails
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(doc.id)}
                        className="px-3 py-1 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-8 border-2 border-dashed border-gray-200 max-w-md mx-auto">
            <div className="text-6xl mb-4">{photoSearchMode ? "🔍" : "📄"}</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-3">
              {photoSearchMode
                ? "Aucun résultat trouvé"
                : searchTerm
                ? "Aucun résultat trouvé"
                : "Aucun document enregistré"}
            </h3>
            <p className="text-gray-500 mb-6">
              {photoSearchMode
                ? "Aucune correspondance trouvée pour cette photo. Essayez avec une autre photo."
                : searchTerm
                ? "Aucun document ne correspond à votre recherche. Essayez avec d'autres termes."
                : "Commencez par extraire et enregistrer vos premiers documents CIN."}
            </p>
            {(searchTerm || photoSearchMode) && (
              <button
                onClick={() => {
                  setSearchTerm("");
                  resetPhotoSearch();
                }}
                className="bg-gradient-to-r from-blue-600 to-blue-500 text-white font-medium py-2 px-6 rounded-lg hover:from-blue-700 hover:to-blue-600"
              >
                {photoSearchMode ? "Retour à la liste" : "Effacer la recherche"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <div className="text-center mb-4">
                <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                  <span className="text-2xl text-red-600">🗑️</span>
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">
                  Confirmer la suppression
                </h3>
                <p className="text-gray-600">
                  Êtes-vous sûr de vouloir supprimer ce document ? Cette action
                  est irréversible.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  onClick={() => handleDeleteDocument(deleteConfirm)}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-lg hover:from-red-700 hover:to-red-600 transition-all disabled:opacity-50 flex items-center justify-center"
                >
                  {deleting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Suppression...
                    </>
                  ) : (
                    "Supprimer"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document Details Modal - UPDATED TO SHOW ACTUAL PHOTO */}
      {showDetails && selectedDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-500 text-white p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Détails du Document</h2>
                  <p className="text-blue-100 mt-1">
                    {selectedDocument.type_document || "CIN"} • N°{" "}
                    {selectedDocument.numero_cin || "N/A"}
                  </p>
                </div>
                <button
                  onClick={handleCloseDetails}
                  className="text-white hover:text-blue-100 text-2xl"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Personal Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">
                    👤 Informations Personnelles
                  </h3>
                  <div>
                    <label className="text-sm text-gray-500">Nom complet</label>
                    <p className="font-medium">
                      {selectedDocument.nom} {selectedDocument.prenoms}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Numéro CIN</label>
                    <p className="font-mono font-medium">
                      {selectedDocument.numero_cin || "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">
                      Date de naissance
                    </label>
                    <p className="font-medium">
                      {formatDate(selectedDocument.date_naissance)}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">
                      Lieu de naissance
                    </label>
                    <p className="font-medium">
                      {selectedDocument.lieu_naissance || "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Sexe</label>
                    <p className="font-medium">
                      {selectedDocument.sexe === "M"
                        ? "Masculin"
                        : selectedDocument.sexe === "F"
                        ? "Féminin"
                        : "Non spécifié"}
                    </p>
                  </div>
                </div>

                {/* Document Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">
                    📄 Informations du Document
                  </h3>
                  <div>
                    <label className="text-sm text-gray-500">
                      Type de document
                    </label>
                    <p className="font-medium">
                      {selectedDocument.type_document ||
                        "Carte d'Identité Nationale"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">
                      Date de délivrance
                    </label>
                    <p className="font-medium">
                      {formatDate(selectedDocument.date_delivrance)}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">
                      Date d'expiration
                    </label>
                    <p className="font-medium">
                      {formatDate(selectedDocument.date_expiration)}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Statut</label>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        getDocumentStatus(selectedDocument.date_expiration)
                          .color === "green"
                          ? "bg-green-100 text-green-800"
                          : getDocumentStatus(selectedDocument.date_expiration)
                              .color === "orange"
                          ? "bg-orange-100 text-orange-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {
                        getDocumentStatus(selectedDocument.date_expiration)
                          .label
                      }
                    </span>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Adresse</label>
                    <p className="font-medium">
                      {selectedDocument.adresse || "N/A"}
                    </p>
                  </div>
                </div>

                {/* Photo Section if available - SHOW ACTUAL PHOTO */}
                {selectedDocument.has_face_photo &&
                  selectedDocument.photo_visage_path && (
                    <div className="md:col-span-2 mt-4">
                      <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">
                        📸 Photo du Document
                      </h3>
                      <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl p-4 border border-gray-200">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm text-gray-600">
                            Photo extraite du document
                          </span>
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                            ✓ Disponible
                          </span>
                        </div>
                        <div className="text-center">
                          <div className="inline-block bg-white p-2 rounded-lg shadow-sm">
                            <div className="w-48 h-48 bg-gray-100 rounded-lg overflow-hidden">
                              <img
                                src={getPhotoUrl(
                                  selectedDocument.photo_visage_path
                                )}
                                alt="Face photo"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.style.display = "none";
                                  e.target.parentElement.innerHTML = `
                                  <div class="w-full h-full flex items-center justify-center">
                                    <span class="text-4xl text-gray-400">👤</span>
                                  </div>
                                `;
                                }}
                              />
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 text-center mt-3">
                          Photo stockée:{" "}
                          {selectedDocument.photo_visage_path
                            ?.split("/")
                            .pop() || "N/A"}
                        </p>
                      </div>
                    </div>
                  )}

                {/* Metadata */}
                <div className="md:col-span-2 pt-4 border-t">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">
                    📊 Métadonnées
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-xs text-gray-500">ID Document</div>
                      <div className="font-mono font-medium">
                        {selectedDocument.id}
                      </div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-xs text-gray-500">Dossier</div>
                      <div className="font-medium truncate">
                        {selectedDocument.folder_name}
                      </div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-xs text-gray-500">Enregistré le</div>
                      <div className="font-medium">
                        {formatDate(selectedDocument.date_sauvegarde)}
                      </div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-xs text-gray-500">Photo</div>
                      <div className="font-medium">
                        {selectedDocument.has_face_photo
                          ? "✓ Disponible"
                          : "✗ Non disponible"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(selectedDocument.id)}
                className="px-6 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
              >
                Supprimer
              </button>
              <button
                onClick={handleCloseDetails}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
