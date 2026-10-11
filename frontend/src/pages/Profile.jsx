import { useEffect, useState } from "react";
import api from "../api/axios";
import Icon from "../components/Icon";
import { useAuth } from "../context/AuthContext";

const emptyProfile = {
  phone: "",
  education: "",
  college: "",
  degree: "",
  graduationYear: "",
  portfolioUrl: "",
  githubUrl: "",
  linkedinUrl: "",
};

const emptyCompanyProfile = { description: "", website: "", industry: "" };

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [name, setName] = useState("");
  const [studentProfile, setStudentProfile] = useState(emptyProfile);
  const [companyProfile, setCompanyProfile] = useState(emptyCompanyProfile);
  const [skills, setSkills] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [resumePreviewUrl, setResumePreviewUrl] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadProfile = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/profile/me");
      setProfile(data);
      setName(data.name || "");
      setStudentProfile({ ...emptyProfile, ...(data.profile || {}) });
      setCompanyProfile({ ...emptyCompanyProfile, ...(data.companyProfile || {}) });
      setSkills((data.skills || []).join(", "));
    } catch (err) {
      setError(err.response?.data?.message || "Could not load your profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => () => {
    if (resumePreviewUrl) URL.revokeObjectURL(resumePreviewUrl);
  }, [resumePreviewUrl]);

  const saveProfile = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload = user?.role === "student"
        ? {
            name,
            profile: {
              ...studentProfile,
              graduationYear: studentProfile.graduationYear ? Number(studentProfile.graduationYear) : undefined,
            },
            skills: skills.split(",").map((skill) => skill.trim()).filter(Boolean),
          }
        : { name, company: profile?.company || "", companyProfile };
      await api.put("/profile/me", payload);
      const { data: currentUser } = await api.get("/auth/me");
      updateUser(currentUser);
      setSuccess("Profile saved.");
      await loadProfile();
    } catch (err) {
      setError(err.response?.data?.message || "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  };

  const updateStudentField = (event) => {
    const { name: field, value } = event.target;
    setStudentProfile((current) => ({ ...current, [field]: value }));
  };

  const handleResumeUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf") || (file.type && file.type !== "application/pdf")) {
      setError("Choose a PDF resume.");
      return;
    }

    setUploading(true);
    setError("");
    setSuccess("");
    try {
      await api.put("/profile/me/resume", file, {
        headers: {
          "Content-Type": "application/pdf",
          "X-File-Name": encodeURIComponent(file.name),
        },
      });
      setSuccess("Resume uploaded and set as your current resume.");
      await loadProfile();
    } catch (err) {
      setError(err.response?.data?.message || "Could not upload this resume.");
    } finally {
      setUploading(false);
    }
  };

  const downloadResume = async () => {
    setError("");
    try {
      const { data } = await api.get("/profile/me/resume", { responseType: "blob" });
      const url = URL.createObjectURL(data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = profile.currentResume.originalName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.message || "Could not download your resume.");
    }
  };

  const previewResume = async () => {
    setError("");
    try {
      const { data } = await api.get("/profile/me/resume", { responseType: "blob" });
      setResumePreviewUrl(URL.createObjectURL(data));
    } catch (err) {
      setError(err.response?.data?.message || "Could not open your resume.");
    }
  };

  const removeResume = async () => {
    if (!window.confirm("Delete your current resume? Resumes attached to applications cannot be deleted.")) return;
    setError("");
    setSuccess("");
    try {
      await api.delete("/profile/me/resume");
      setSuccess("Resume deleted.");
      await loadProfile();
    } catch (err) {
      setError(err.response?.data?.message || "Could not delete your resume.");
    }
  };

  if (loading && !profile) return <div className="page"><p>Loading profile...</p></div>;
  if (!profile) return <div className="page"><p className="error" role="alert">{error || "Profile unavailable."}</p><button type="button" onClick={loadProfile}>Retry</button></div>;

  return (
    <div className="page profile-page">
      <div className="dashboard-heading">
        <div><span className="eyebrow">YOUR ACCOUNT</span><h2>{user?.role === "recruiter" ? "Company profile" : "Student profile"}</h2></div>
        <p className="muted">{profile.email}</p>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {success && <p className="success" role="status">{success}</p>}

      {user?.role === "student" && (
        <section className="profile-completion" aria-label={`Profile ${profile.profileCompletion}% complete`}>
          <div><span className="eyebrow">PROFILE COMPLETION</span><strong>{profile.profileCompletion}%</strong></div>
          <span className="completion-track"><span style={{ width: `${profile.profileCompletion}%` }} /></span>
          <p className="muted">Add your education, skills, and resume to help recruiters review your application.</p>
        </section>
      )}

      <form className="profile-form" onSubmit={saveProfile}>
        <section className="profile-section">
          <div className="section-heading-compact"><div><span className="eyebrow">BASICS</span><h3>About you</h3></div></div>
          <div className="profile-fields">
            <label>Full name<input aria-label="Full name" value={name} maxLength={100} onChange={(event) => setName(event.target.value)} required /></label>
            <label>Email<input aria-label="Email" value={profile.email} readOnly /></label>
            {user?.role === "student" ? (
              <>
                <label>Phone<input aria-label="Phone" name="phone" value={studentProfile.phone} maxLength={40} onChange={updateStudentField} /></label>
                <label>Education<input aria-label="Education" name="education" value={studentProfile.education} maxLength={160} onChange={updateStudentField} placeholder="e.g. Undergraduate" /></label>
                <label>College<input aria-label="College" name="college" value={studentProfile.college} maxLength={160} onChange={updateStudentField} /></label>
                <label>Degree<input aria-label="Degree" name="degree" value={studentProfile.degree} maxLength={160} onChange={updateStudentField} /></label>
                <label>Graduation year<input aria-label="Graduation year" name="graduationYear" type="number" min="1950" max="2100" value={studentProfile.graduationYear} onChange={updateStudentField} /></label>
                <label className="profile-field-wide">Skills<input aria-label="Skills, comma separated" value={skills} onChange={(event) => setSkills(event.target.value)} placeholder="React, Node.js, SQL" /></label>
                <label>Portfolio URL<input aria-label="Portfolio URL" name="portfolioUrl" type="url" value={studentProfile.portfolioUrl} onChange={updateStudentField} /></label>
                <label>GitHub URL<input aria-label="GitHub URL" name="githubUrl" type="url" value={studentProfile.githubUrl} onChange={updateStudentField} /></label>
                <label>LinkedIn URL<input aria-label="LinkedIn URL" name="linkedinUrl" type="url" value={studentProfile.linkedinUrl} onChange={updateStudentField} /></label>
              </>
            ) : (
              <>
                <label>Company name<input aria-label="Company name" value={profile.company || ""} maxLength={120} onChange={(event) => setProfile((current) => ({ ...current, company: event.target.value }))} /></label>
                <label>Industry<input aria-label="Industry" value={companyProfile.industry} maxLength={100} onChange={(event) => setCompanyProfile((current) => ({ ...current, industry: event.target.value }))} /></label>
                <label>Website<input aria-label="Company website" type="url" value={companyProfile.website} onChange={(event) => setCompanyProfile((current) => ({ ...current, website: event.target.value }))} /></label>
                <label className="profile-field-wide">Company description<textarea aria-label="Company description" maxLength={2000} value={companyProfile.description} onChange={(event) => setCompanyProfile((current) => ({ ...current, description: event.target.value }))} /></label>
              </>
            )}
          </div>
          <button type="submit" disabled={saving}>{saving ? "Saving..." : "Save profile"}</button>
        </section>
      </form>

      {user?.role === "student" && (
        <section className="profile-section resume-section">
          <div className="section-heading-compact"><div><span className="eyebrow">APPLICATION DOCUMENT</span><h3>Resume</h3></div></div>
          {profile.currentResume ? (
            <div className="resume-summary">
              <span className="metric-icon metric-icon-green"><Icon name="file" /></span>
              <div className="resume-copy"><strong>{profile.currentResume.originalName}</strong><span>{Math.ceil(profile.currentResume.size / 1024)} KB · PDF</span></div>
              <button type="button" className="button-quiet" onClick={downloadResume}>Download</button>
              <button type="button" className="button-quiet" onClick={previewResume}>Preview</button>
              <button type="button" className="button-quiet resume-remove" onClick={removeResume}>Delete</button>
            </div>
          ) : <p className="muted">No resume uploaded. Upload a PDF to attach it to internship applications.</p>}
          {resumePreviewUrl && <div className="resume-preview"><div><strong>Resume preview</strong><button type="button" className="button-quiet" onClick={() => setResumePreviewUrl("")}>Close preview</button></div><iframe title="Current resume PDF preview" src={resumePreviewUrl} /></div>}
          <label className="resume-upload">
            <Icon name="file" size={18} />
            <span>{uploading ? "Uploading..." : profile.currentResume ? "Replace resume" : "Choose PDF resume"}</span>
            <input type="file" accept="application/pdf,.pdf" disabled={uploading} onChange={handleResumeUpload} />
          </label>
          <p className="muted">PDF only. File size is validated by the server. Replacing a resume does not alter copies attached to existing applications.</p>
        </section>
      )}
    </div>
  );
}