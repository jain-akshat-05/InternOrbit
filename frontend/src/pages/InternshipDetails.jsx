import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../api/axios";
import Icon from "../components/Icon";
import { useAuth } from "../context/AuthContext";

export default function InternshipDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [internship, setInternship] = useState(null);
  const [profile, setProfile] = useState(null);
  const [coverLetter, setCoverLetter] = useState("");
  const [answers, setAnswers] = useState({});
  const [resumeId, setResumeId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const { data } = await api.get(`/internships/${id}`);
        if (active) {
          setInternship(data);
          setAnswers(Object.fromEntries((data.applicationQuestions || []).map((question) => [question, ""])));
        }
        if (user?.role === "student") {
          const { data: profileData } = await api.get("/profile/me");
          if (active) {
            setProfile(profileData);
            setResumeId(profileData.currentResume?._id || "");
          }
        }
      } catch (err) {
        if (active) setError(err.response?.data?.message || "Could not load this internship.");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [id, user?.role]);

  const submitApplication = async (event) => {
    event.preventDefault();
    setError("");
    if (!resumeId) {
      setError("Upload a PDF resume in your profile before applying.");
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post("/applications", {
        internshipId: internship._id,
        resumeId,
        coverLetter,
        answers: (internship.applicationQuestions || []).map((question) => ({ question, answer: answers[question] || "" })),
      });
      navigate(`/my-applications/${data._id}`);
    } catch (err) {
      setError(err.response?.data?.message || "Could not submit your application.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="page"><p>Loading internship...</p></div>;
  if (error && !internship) return <div className="page"><p className="error" role="alert">{error}</p><Link to="/">Back to internships</Link></div>;
  if (!internship) return null;

  return (
    <div className="page detail-page">
      <Link className="back-link" to="/">← All internships</Link>
      <div className="detail-layout">
        <article className="detail-main">
          <div className="detail-company-mark" aria-hidden="true"><Icon name="briefcase" size={25} /></div>
          <span className="eyebrow">INTERNSHIP OPPORTUNITY</span>
          <h1>{internship.title}</h1>
          <p className="detail-company">{internship.company} <span aria-hidden="true">·</span> {internship.location}</p>
          <div className="detail-facts">
            <span><small>Stipend</small><strong>₹{internship.stipend}</strong></span>
            <span><small>Duration</small><strong>{internship.duration}</strong></span>
          </div>
          <section className="detail-section">
            <h2>About the internship</h2>
            <p>{internship.description}</p>
          </section>
          {internship.skillsRequired?.length > 0 && (
            <section className="detail-section">
              <h2>Skills</h2>
              <div className="skill-list">{internship.skillsRequired.map((skill, index) => <span className="skill-chip" key={`${skill}-${index}`}>{skill}</span>)}</div>
            </section>
          )}
          {user?.role === "student" && (
            <section className="detail-section application-form-section">
              <span className="eyebrow">YOUR APPLICATION</span>
              <h2>Apply for this internship</h2>
              {error && <p className="error" role="alert">{error}</p>}
              <form className="application-form" onSubmit={submitApplication}>
                {profile?.currentResume ? (
                  <label>Resume
                    <select aria-label="Resume to submit" value={resumeId} onChange={(event) => setResumeId(event.target.value)} required>
                      <option value={profile.currentResume._id}>{profile.currentResume.originalName} · PDF</option>
                    </select>
                  </label>
                ) : (
                  <p className="info">A resume is required. <Link to="/profile">Upload one in your profile</Link>.</p>
                )}
                <label>Cover letter <textarea aria-label="Cover letter" maxLength={5000} value={coverLetter} onChange={(event) => setCoverLetter(event.target.value)} placeholder="Tell the recruiter why this opportunity fits your goals." /></label>
                {(internship.applicationQuestions || []).map((question) => (
                  <label key={question}>{question}<textarea aria-label={question} maxLength={3000} required value={answers[question] || ""} onChange={(event) => setAnswers((current) => ({ ...current, [question]: event.target.value }))} /></label>
                ))}
                <button type="submit" disabled={submitting || !resumeId}>{submitting ? "Submitting..." : "Submit application"}</button>
              </form>
            </section>
          )}
          {!user && <p className="info"><Link to="/login">Log in as a student</Link> to apply.</p>}
        </article>
        <aside className="detail-aside">
          <img src="/images/opportunity-map.svg" alt="Application milestones illustration" />
          <h2>Make your next step count.</h2>
          <p>Applications and their updates stay available in your student dashboard.</p>
          {user?.role === "student" && <Link to="/my-applications">View my applications</Link>}
        </aside>
      </div>
    </div>
  );
}