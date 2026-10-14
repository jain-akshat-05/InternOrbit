import { useId, useState } from "react";
import api from "../api/axios";
import { getApiErrorMessage } from "../api/errors";
import { isPdfResume } from "../api/resumeValidation";

export default function ResumeUploader({ currentResume, onUploaded, onUploadingChange }) {
  const inputId = useId();
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const isPdf = isPdfResume(selectedFile);

  const selectFile = (event) => {
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    setSelectedFile(file);
    setError("");
    setSuccess("");
    if (file && !isPdfResume(file)) {
      setError("Choose a PDF resume.");
    }
  };

  const uploadFile = async () => {
    if (!selectedFile || !isPdf || uploading) return;
    setUploading(true);
    onUploadingChange?.(true);
    setError("");
    setSuccess("");
    try {
      const { data } = await api.put("/profile/me/resume", selectedFile, {
        headers: {
          "Content-Type": "application/pdf",
          "X-File-Name": encodeURIComponent(selectedFile.name),
        },
      });
      setSuccess(`${data.originalName} uploaded.`);
      setSelectedFile(null);
      onUploaded?.(data);
    } catch (uploadError) {
      setError(getApiErrorMessage(uploadError, "Could not upload this resume."));
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
    }
  };

  return (
    <div className="resume-uploader">
      <label htmlFor={inputId}>Choose a PDF resume</label>
      <input
        id={inputId}
        type="file"
        accept="application/pdf,.pdf"
        aria-label="Choose a PDF resume"
        disabled={uploading}
        onChange={selectFile}
      />
      <span className="muted" role="status" aria-live="polite">
        {selectedFile ? `Selected: ${selectedFile.name}` : currentResume ? `Current resume: ${currentResume.originalName}` : "No resume selected."}
      </span>
      {error && <p className="error" role="alert">{error}</p>}
      {success && <p className="success" role="status">{success}</p>}
      <button type="button" onClick={uploadFile} disabled={!selectedFile || !isPdf || uploading}>
        {uploading ? "Uploading resume..." : "Upload resume"}
      </button>
    </div>
  );
}
