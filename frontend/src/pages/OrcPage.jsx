import { useState } from "react";
import axios from "axios";

const API_URL = "http://localhost:8000";

export default function OrcPage() {
  const [rectoData, setRectoData] = useState({});
  const [versoData, setVersoData] = useState({});
  const [facePhoto, setFacePhoto] = useState(null);
  const [facePhoto64, setFacePhoto64] = useState("");
  const [combinedData, setCombinedData] = useState({});
  const [imageRecto, setImageRecto] = useState(null);
  const [imageVerso, setImageVerso] = useState(null);
  const [image64Recto, setImage64Recto] = useState("");
  const [image64Verso, setImage64Verso] = useState("");
  const [currentStep, setCurrentStep] = useState("recto");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [justSaved, setJustSaved] = useState(false);

  const combineData = (recto, verso) => {
    const combined = { ...recto };

    const versoFieldsToAdd = {
      date_delivrance: verso.date_delivrance,
      date_expiration: verso.date_expiration,
      adresse: verso.adresse,
    };

    Object.entries(versoFieldsToAdd).forEach(([key, value]) => {
      if (value) combined[key] = value;
    });

    if (combined.date_delivrance && !combined.date_expiration) {
      try {
        const [day, month, year] = combined.date_delivrance
          .split("/")
          .map(Number);
        const deliveryDate = new Date(year, month - 1, day);
        const expirationDate = new Date(deliveryDate);
        expirationDate.setFullYear(expirationDate.getFullYear() + 10);

        const expDay = expirationDate.getDate().toString().padStart(2, "0");
        const expMonth = (expirationDate.getMonth() + 1)
          .toString()
          .padStart(2, "0");
        const expYear = expirationDate.getFullYear();

        combined.date_expiration = `${expDay}/${expMonth}/${expYear}`;
      } catch (e) {
        console.error("Error calculating expiration date:", e);
      }
    }

    return combined;
  };

  const extractFacePhoto = async (imageBase64) => {
    try {
      const byteCharacters = atob(imageBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "image/jpeg" });

      const form = new FormData();
      form.append("file", blob, "cin_image.jpg");

      const res = await axios.post(`${API_URL}/extract-photo`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data.success && res.data.photo_base64) {
        setFacePhoto(`data:image/jpeg;base64,${res.data.photo_base64}`);
        setFacePhoto64(res.data.photo_base64);
        return res.data.photo_base64;
      }
    } catch (err) {
      console.error("Face extraction failed:", err);
    }
    return null;
  };

  // const handleImageUpload = async (e, side) => {
  //   const file = e.target.files[0];
  //   if (!file) return;

  //   const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
  //   if (!allowedTypes.includes(file.type)) {
  //     setError("Type de fichier invalide. Utilisez PNG, JPG, JPEG ou WEBP");
  //     return;
  //   }

  //   if (file.size > 10 * 1024 * 1024) {
  //     setError("Le fichier doit être inférieur à 10 MB");
  //     return;
  //   }

  //   setLoading(true);
  //   setError("");
  //   setSuccess("");

  //   try {
  //     const reader = new FileReader();
  //     reader.onload = (e) => {
  //       if (side === "recto") {
  //         setImageRecto(e.target.result);
  //       } else {
  //         setImageVerso(e.target.result);
  //       }
  //     };
  //     reader.readAsDataURL(file);

  //     const form = new FormData();
  //     form.append("file", file);

  //     const res = await axios.post(`${API_URL}/ocr`, form, {
  //       headers: { "Content-Type": "multipart/form-data" },
  //     });

  //     if (side === "recto") {
  //       setRectoData(res.data.data);
  //       setImage64Recto(res.data.image_base64);

  //       if (res.data.image_base64) {
  //         await extractFacePhoto(res.data.image_base64);
  //       }

  //       setSuccess("✅ Recto extrait! Maintenant, uploadez le verso.");
  //       setCurrentStep("verso");
  //     } else {
  //       setVersoData(res.data.data);
  //       setImage64Verso(res.data.image_base64);

  //       const combined = combineData(rectoData, res.data.data);
  //       setCombinedData(combined);

  //       setSuccess("✅ Verso extrait! Données combinées. Vous pouvez maintenant éditer.");
  //       setCurrentStep("edit");
  //     }
  //   } catch (err) {
  //     setError(err.response?.data?.detail || "Erreur lors de l'extraction");
  //     console.error("Erreur OCR:", err);
  //   } finally {
  //     setLoading(false);
  //   }
  // };
  const handleImageUpload = async (e, side) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setError("Type de fichier invalide. Utilisez PNG, JPG, JPEG ou WEBP");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Le fichier doit être inférieur à 10 MB");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (side === "recto") {
          setImageRecto(e.target.result);
        } else {
          setImageVerso(e.target.result);
        }
      };
      reader.readAsDataURL(file);

      const form = new FormData();
      form.append("file", file);

      console.log(`📤 Uploading ${side}...`);
      const res = await axios.post(`${API_URL}/ocr`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      console.log(`✅ ${side} OCR response:`, res.data.data);

      if (side === "recto") {
        const rectoInfo = res.data.data;
        const rectoImage = res.data.image_base64;

        // Update recto data immediately
        setRectoData(rectoInfo);
        setImage64Recto(rectoImage);

        // Extract face photo and wait for it
        if (rectoImage) {
          console.log("🔍 Extracting face photo...");
          await extractFacePhoto(rectoImage);
          console.log("✅ Face extraction completed");
        }

        setSuccess("✅ Recto extrait! Maintenant, uploadez le verso.");
        setCurrentStep("verso");
      } else {
        const versoInfo = res.data.data;
        const versoImage = res.data.image_base64;

        // Update verso data
        setVersoData(versoInfo);
        setImage64Verso(versoImage);

        // Combine data using the LATEST recto data
        const combined = combineData(rectoData, versoInfo);
        console.log("📋 Combined data:", combined);
        setCombinedData(combined);

        setSuccess(
          "✅ Verso extrait! Données combinées. Vous pouvez maintenant éditer."
        );
        setCurrentStep("edit");
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Erreur lors de l'extraction");
      console.error("❌ Erreur OCR:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSkipVerso = () => {
    const combined = combineData(rectoData, {});
    setCombinedData(combined);
    setCurrentStep("edit");
    setSuccess("✅ Recto seulement. Vous pouvez maintenant éditer.");
  };

  const handleFieldChange = (key, value) => {
    setCombinedData({ ...combinedData, [key]: value });
  };

  const handleSave = async () => {
    if (!image64Recto || Object.keys(combinedData).length === 0) {
      setError("Aucun document à enregistrer");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      // Prepare ONLY the required fields
      const finalData = {
        type_document: combinedData.type_document || "",
        numero_cin: combinedData.numero_cin || "",
        nom: combinedData.nom || "",
        prenoms: combinedData.prenoms || "",
        date_naissance: combinedData.date_naissance || "",
        lieu_naissance: combinedData.lieu_naissance || "",
        sexe: combinedData.sexe || "",
        date_delivrance: combinedData.date_delivrance || "",
        date_expiration: combinedData.date_expiration || "",
        adresse: combinedData.adresse || "",
      };

      // Save ONCE with the recto image (face will be extracted server-side)
      const saveResponse = await axios.post(`${API_URL}/save`, {
        data: finalData,
        image_base64: image64Recto,
        filename: "cin_document.jpg",
      });

      setSuccess(
        `✅ Document enregistré avec succès!${
          saveResponse.data.files?.photo_visage ? " Photo extraite." : ""
        }`
      );
      setJustSaved(true);

      // Auto-reset after 2 seconds
      setTimeout(() => {
        handleReset();
        setJustSaved(false);
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.detail || "Erreur lors de l'enregistrement");
      console.error("Erreur sauvegarde:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setRectoData({});
    setVersoData({});
    setCombinedData({});
    setFacePhoto(null);
    setFacePhoto64("");
    setImageRecto(null);
    setImageVerso(null);
    setImage64Recto("");
    setImage64Verso("");
    setCurrentStep("recto");
    setError("");
    setSuccess("");
  };

  return (
    <div className="bg-gradient-to-br from-[#F1FAFF] to-[#CBE4FF] min-h-screen rounded-xl">
      {error && (
        <div className="mb-4">
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

      {success && (
        <div className="mb-4">
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center justify-between shadow-sm">
            <div className="flex items-center">
              <span className="mr-2">✅</span>
              <span>{success}</span>
              {justSaved && (
                <span className="ml-3 text-sm text-green-600 font-medium animate-pulse">
                  Redémarrage automatique...
                </span>
              )}
            </div>
            <button
              onClick={() => setSuccess("")}
              className="text-green-600 hover:text-green-800 font-bold"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white shadow-lg rounded-2xl p-6 border border-gray-100">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center">
            <span className="mr-2">🖼️</span>
            Aperçu des Images
          </h2>

          <div className="space-y-6">
            {imageRecto && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-700">
                    Recto{" "}
                    {rectoData.type_document && `- ${rectoData.type_document}`}
                  </h3>
                  <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">
                    ÉTAPE 1
                  </div>
                </div>
                <div className="border-2 border-blue-200 rounded-xl overflow-hidden shadow-sm">
                  <img
                    src={imageRecto}
                    alt="Recto"
                    className="w-full h-auto object-contain max-h-[350px] bg-gray-50"
                  />
                </div>
                <div className="mt-3 text-sm text-gray-600 bg-blue-50 px-3 py-2 rounded-lg">
                  {rectoData.numero_cin && (
                    <span className="font-medium">
                      N°: {rectoData.numero_cin}
                    </span>
                  )}
                  {rectoData.nom && rectoData.prenoms && (
                    <span className="ml-2">
                      - {rectoData.nom} {rectoData.prenoms}
                    </span>
                  )}
                </div>
              </div>
            )}

            {facePhoto && (
              <div>
                <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center">
                  <span className="mr-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white p-2 rounded-lg">
                    👤
                  </span>
                  Photo Extraite
                  <span className="ml-2 text-sm bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">
                    ✓ Détectée automatiquement
                  </span>
                </h3>
                <div className="border-2 border-purple-200 rounded-xl overflow-hidden bg-gradient-to-br from-purple-50 to-pink-50 p-2 shadow-sm">
                  <img
                    src={facePhoto}
                    alt="Photo Visage"
                    className="w-full h-auto object-contain max-h-[200px] rounded-lg"
                  />
                </div>
                <div className="mt-3 text-sm text-gray-600 text-center bg-purple-50 px-3 py-2 rounded-lg">
                  Portrait extrait du recto
                </div>
              </div>
            )}

            {imageVerso && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-700">Verso</h3>
                  <div className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">
                    ÉTAPE 2
                  </div>
                </div>
                <div className="border-2 border-green-200 rounded-xl overflow-hidden shadow-sm">
                  <img
                    src={imageVerso}
                    alt="Verso"
                    className="w-full h-auto object-contain max-h-[350px] bg-gray-50"
                  />
                </div>
                <div className="mt-3 text-sm text-gray-600 bg-green-50 px-3 py-2 rounded-lg">
                  {versoData.date_delivrance && (
                    <span className="font-medium">
                      Délivré: {versoData.date_delivrance}
                    </span>
                  )}
                  {versoData.date_expiration && (
                    <span className="ml-2">
                      | Expire: {versoData.date_expiration}
                    </span>
                  )}
                </div>
              </div>
            )}

            {!imageRecto && !imageVerso && !facePhoto && (
              <div className="text-center py-20 text-gray-400">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 border-2 border-dashed border-gray-200">
                  <svg
                    className="mx-auto h-24 w-24 mb-6 text-gray-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <p className="text-lg font-medium text-gray-500">
                    Les images apparaîtront ici...
                  </p>
                  <p className="text-sm text-gray-400 mt-2">
                    Commencez par télécharger le recto du document
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white shadow-lg rounded-2xl p-6 border border-gray-100">
          <div className="mb-8 flex items-center justify-between">
            <div
              className={`flex items-center ${
                currentStep === "recto"
                  ? "text-blue-600 font-semibold"
                  : "text-gray-400"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  currentStep === "recto"
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-gray-100"
                }`}
              >
                1
              </div>
              <span className="ml-3 font-medium">Recto</span>
            </div>

            <div className="flex-1 h-1.5 mx-4 bg-gray-100 rounded-full">
              <div
                className={`h-full rounded-full ${
                  currentStep !== "recto" ? "bg-blue-600" : "bg-gray-200"
                } transition-all`}
              ></div>
            </div>

            <div
              className={`flex items-center ${
                currentStep === "verso"
                  ? "text-green-600 font-semibold"
                  : "text-gray-400"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  currentStep === "verso" || currentStep === "edit"
                    ? "bg-green-600 text-white shadow-md"
                    : "bg-gray-100"
                }`}
              >
                2
              </div>
              <span className="ml-3 font-medium">Verso</span>
            </div>

            <div className="flex-1 h-1.5 mx-4 bg-gray-100 rounded-full">
              <div
                className={`h-full rounded-full ${
                  currentStep === "edit" ? "bg-blue-600" : "bg-gray-200"
                } transition-all`}
              ></div>
            </div>

            <div
              className={`flex items-center ${
                currentStep === "edit"
                  ? "text-indigo-600 font-semibold"
                  : "text-gray-400"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  currentStep === "edit"
                    ? "bg-indigo-600 text-white shadow-md"
                    : "bg-gray-100"
                }`}
              >
                3
              </div>
              <span className="ml-3 font-medium">Éditer</span>
            </div>
          </div>

          {currentStep === "recto" && (
            <div>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center">
                <span className="mr-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white p-2 rounded-lg">
                  📤
                </span>
                Étape 1: Téléchargez le RECTO
              </h2>
              <p className="text-gray-600 mb-6 bg-blue-50 p-4 rounded-xl">
                Le recto contient généralement:{" "}
                <span className="font-medium">Type de document</span>,{" "}
                <span className="font-medium">Numéro CIN</span>,{" "}
                <span className="font-medium">Nom</span>,{" "}
                <span className="font-medium">Prénom</span>,{" "}
                <span className="font-medium">Date de naissance</span>,{" "}
                <span className="font-medium">Lieu de naissance</span>,{" "}
                <span className="font-medium">Sexe</span>
              </p>
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={(e) => handleImageUpload(e, "recto")}
                disabled={loading}
                className="block w-full text-sm text-gray-600
                  file:mr-4 file:py-3 file:px-6
                  file:rounded-xl file:border-0
                  file:text-sm file:font-semibold
                  file:bg-gradient-to-r file:from-blue-600 file:to-blue-500 file:text-white
                  hover:file:from-blue-700 hover:file:to-blue-600
                  file:cursor-pointer cursor-pointer
                  border-2 border-dashed border-blue-200 rounded-xl
                  disabled:opacity-50 bg-blue-50/50"
              />
            </div>
          )}

          {currentStep === "verso" && (
            <div>
              <h2 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center">
                <span className="mr-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white p-2 rounded-lg">
                  📤
                </span>
                Étape 2: Téléchargez le VERSO
              </h2>
              <p className="text-gray-600 mb-6 bg-green-50 p-4 rounded-xl">
                Le verso contient généralement:{" "}
                <span className="font-medium">Date de délivrance</span>,{" "}
                <span className="font-medium">Date d'expiration</span>,{" "}
                <span className="font-medium">Adresse</span>
              </p>
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={(e) => handleImageUpload(e, "verso")}
                disabled={loading}
                className="block w-full text-sm text-gray-600
                  file:mr-4 file:py-3 file:px-6
                  file:rounded-xl file:border-0
                  file:text-sm file:font-semibold
                  file:bg-gradient-to-r file:from-green-600 file:to-emerald-500 file:text-white
                  hover:file:from-green-700 hover:file:to-emerald-600
                  file:cursor-pointer cursor-pointer
                  border-2 border-dashed border-green-200 rounded-xl
                  disabled:opacity-50 bg-green-50/50"
              />
              <button
                onClick={handleSkipVerso}
                className="mt-4 w-full bg-gradient-to-r from-gray-600 to-gray-500 text-white py-3 rounded-xl hover:from-gray-700 hover:to-gray-600 font-medium shadow-sm"
              >
                Passer sans verso (utiliser seulement le recto)
              </button>
            </div>
          )}

          {loading && (
            <div className="mt-6 flex flex-col items-center justify-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <span className="text-gray-600 font-medium">
                Traitement en cours...
              </span>
              <p className="text-sm text-gray-500 mt-2">
                Extraction des données depuis l'image
              </p>
            </div>
          )}

          {currentStep === "edit" && Object.keys(combinedData).length > 0 && (
            <div>
              <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center">
                <span className="mr-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-2 rounded-lg">
                  ✏️
                </span>
                Étape 3: Modifier les Champs combinés
              </h2>

              <div className="mb-6 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-700">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                    <span className="font-medium">
                      Recto: {Object.keys(rectoData).length} champs
                    </span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                    <span className="font-medium">
                      Verso: {Object.keys(versoData).length} champs
                    </span>
                  </div>
                  {facePhoto && (
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-purple-500 rounded-full mr-2"></div>
                      <span className="font-medium">Photo: ✓ Extraite</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-5 max-h-[500px] overflow-y-auto pr-2">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <div className="w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
                    Informations Recto
                  </h3>
                  <div className="space-y-4">
                    {[
                      "type_document",
                      "numero_cin",
                      "nom",
                      "prenoms",
                      "date_naissance",
                      "lieu_naissance",
                      "sexe",
                    ].map(
                      (key) =>
                        rectoData[key] !== undefined && (
                          <div key={key} className="mb-1">
                            <label className="block text-sm font-medium text-gray-700 mb-2 capitalize">
                              {key.replace(/_/g, " ")}
                            </label>
                            <input
                              type="text"
                              value={combinedData[key] || rectoData[key] || ""}
                              onChange={(e) =>
                                handleFieldChange(key, e.target.value)
                              }
                              disabled={loading}
                              className="w-full border border-gray-200 rounded-lg px-4 py-3 
                              focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none
                              disabled:bg-gray-100 bg-white shadow-sm"
                            />
                          </div>
                        )
                    )}
                  </div>
                </div>

                {Object.keys(versoData).length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                      <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                      Informations Verso
                    </h3>
                    <div className="space-y-4">
                      {["date_delivrance", "date_expiration", "adresse"].map(
                        (key) =>
                          versoData[key] !== undefined && (
                            <div key={key} className="mb-1">
                              <label className="block text-sm font-medium text-gray-700 mb-2 capitalize">
                                {key.replace(/_/g, " ")}
                              </label>
                              <input
                                type="text"
                                value={
                                  combinedData[key] || versoData[key] || ""
                                }
                                onChange={(e) =>
                                  handleFieldChange(key, e.target.value)
                                }
                                disabled={loading}
                                className="w-full border border-gray-200 rounded-lg px-4 py-3 
                                focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none
                                disabled:bg-gray-100 bg-white shadow-sm"
                              />
                            </div>
                          )
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-8 flex gap-4">
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold py-4 px-6 
                    rounded-xl hover:from-blue-700 hover:to-blue-600 transition-all shadow-md hover:shadow-lg
                    disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  <span className="mr-2">💾</span>
                  {loading ? "Enregistrement..." : "Enregistrer le Document"}
                </button>

                <button
                  onClick={handleReset}
                  disabled={loading}
                  className="bg-gradient-to-r from-gray-200 to-gray-100 text-gray-700 font-semibold py-4 px-6 
                    rounded-xl hover:from-gray-300 hover:to-gray-200 transition-all shadow-sm hover:shadow
                    disabled:opacity-50 flex items-center justify-center"
                >
                  <span className="mr-2">🔄</span>
                  Nouveau
                </button>
              </div>
            </div>
          )}

          {currentStep === "edit" && Object.keys(combinedData).length === 0 && (
            <div className="text-center py-12">
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-8 border-2 border-dashed border-gray-200">
                <div className="text-5xl mb-4">📝</div>
                <p className="text-lg font-medium text-gray-600">
                  Aucune donnée extraite.
                </p>
                <p className="text-gray-500 mt-2">
                  Veuillez réessayer en téléchargeant le recto du document.
                </p>
                <button
                  onClick={handleReset}
                  className="mt-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-medium py-2 px-6 rounded-lg hover:from-blue-700 hover:to-blue-600"
                >
                  Recommencer
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
