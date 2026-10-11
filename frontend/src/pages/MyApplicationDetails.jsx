import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/axios";
import Icon from "../components/Icon";
import { useAuth } from "../context/AuthContext";

const formatDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
};

const terminalStatuses = ["selected", "rejected", "withdrawn"];

export default function MyApplicationDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [resumePreviewUrl, setResumePreviewUrl] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(`/applications/${id}`);
      setApplication(data);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load this application.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  useEffect(() => () => {
    if (resumePreviewUrl) URL.revokeObjectURL(resumePreviewUrl);
  }, [resumePreviewUrl]);

  const withdraw = async () => {
    if (!window.confirm("Withdraw this application? You cannot reverse this action.")) return;
    setBusy(true);
    setError("");
    try {
      await api.patch(`/applications/${id}/withdraw`);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not withdraw this application.");
    } finally {
      setBusy(false);
    }
  };

  const downloadResume = async () => {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.get(`/applications/${id}/resume`, { responseType: "blob" });
      const url = URL.createObjectURL(data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = application.resume?.originalName || "resume.pdf";
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err.response?.data?.message || "Could not download the attached resume.");
    } finally {
      setBusy(false);
    }
  };

  const previewResume = async () => {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.get(`/applications/${id}/resume`, { responseType: "blob" });
      setResumePreviewUrl(URL.createObjectURL(data));
    } catch (err) {
      setError(err.response?.data?.message || "Could not preview the attached resume.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="page"><p>Loading application...</p></div>;
  if (!application) return <div className="page"><p className="error" role="alert">{error || "Application unavailable."}</p><button type="button" onClick={load}>Retry</button></div>;

  const canWithdraw = !terminalStatuses.includes(application.status);
  const listPath = user?.role === "student" ? "/my-applications" : "/recruiter";

  return (
    <div className="page application-detail-page">
      <Link className="back-link" to={listPath}>{user?.role === "student" ? "← My applications" : "← Recruiter dashboard"}</Link>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="application-detail-heading">
        <div>
          <span className="eyebrow">APPLICATION TRACKER</span>
          <h1>{application.internship?.title || "Internship application"}</h1>
          <p className="muted">{application.internship?.company}</p>
        </div>
        <span className={`application-status badge-${application.status === "selected" ? "success" : application.status === "rejected" ? "danger" : application.status === "interview" || application.status === "assessment" ? "warning" : "info"}`}>
          <Icon name="clock" size={17} />{application.status}
        </span>
      </div>

      <section className="status-overview" aria-labelledby="application-history-title">
        <div className="section-heading-compact"><div><span className="eyebrow">PROGRESS</span><h2 id="application-history-title">Application history</h2></div></div>
        <ol className="application-timeline">
          {(application.statusHistory || []).map((entry, index) => (
            <li className="timeline-entry" key={`${entry._id || entry.changedAt}-${index}`}>
              <span className="timeline-marker"><Icon name={entry.to === "rejected" ? "xCircle" : "check"} size={17} /></span>
              <div><strong>{entry.to}</strong><time dateTime={entry.changedAt}>{formatDate(entry.changedAt)}</time>{entry.note && <p>{entry.note}</p>}</div>
            </li>
          ))}
          {(application.statusHistory || []).length === 0 && <li className="timeline-entry"><span className="timeline-marker"><Icon name="file" size={17} /></span><div><strong>Application submitted</strong><time dateTime={application.createdAt}>{formatDate(application.createdAt)}</time></div></li>}
        </ol>
      </section>

      <section className="application-rounds-section" aria-labelledby="rounds-title">
        <div className="section-heading-compact"><div><span className="eyebrow">RECRUITMENT</span><h2 id="rounds-title">Hiring rounds</h2></div></div>
        {application.rounds?.length ? (
          <div className="round-cards">
            {application.rounds.map(({ _id, round, outcome, resultPublished }) => (
              <article className="round-card" key={_id}>
                <div className="application-mark"><Icon name="calendar" size={20} /></div>
                <div className="round-card-content">
                  <span className="eyebrow">{round.type.replaceAll("_", " ")}</span>
                  <h3>{round.title}</h3>
                  {round.scheduledAt && <time dateTime={round.scheduledAt}>{formatDate(round.scheduledAt)}</time>}
                  {round.instructions && <p>{round.instructions}</p>}
                  {round.meetingUrl && <a href={round.meetingUrl} target="_blank" rel="noreferrer">Open meeting or assessment link</a>}
                  {resultPublished && <span className={`badge ${outcome === "passed" ? "badge-success" : outcome === "failed" || outcome === "not_attended" ? "badge-danger" : "badge-neutral"}`}>Result: {outcome.replaceAll("_", " ")}</span>}
                </div>
              </article>
            ))}
          </div>
        ) : <p className="muted">No published hiring rounds for this application yet.</p>}
      </section>

      <section className="application-document" aria-labelledby="application-document-title">
        <div><span className="eyebrow">SUBMITTED MATERIAL</span><h2 id="application-document-title">Your application</h2><p className="muted">Resume: {application.resume?.originalName || "Not available"}</p></div>
        {application.resume && <div className="resume-actions"><button type="button" className="button-quiet" disabled={busy} onClick={previewResume}><Icon name="file" size={17} />Preview submitted resume</button><button type="button" className="button-quiet" disabled={busy} onClick={downloadResume}>Download</button></div>}
        {resumePreviewUrl && <div className="resume-preview"><div><strong>Submitted resume preview</strong><button type="button" className="button-quiet" onClick={() => setResumePreviewUrl("")}>Close preview</button></div><iframe title="Submitted resume PDF preview" src={resumePreviewUrl} /></div>}
        {application.coverLetter && <div className="cover-letter"><h3>Cover letter</h3><p>{application.coverLetter}</p></div>}
        {application.answers?.length > 0 && <div className="application-answers">{application.answers.map((answer, index) => <div key={`${answer.question}-${index}`}><strong>{answer.question}</strong><p>{answer.answer}</p></div>)}</div>}
      </section>

      {user?.role === "student" && canWithdraw && <div className="application-withdraw"><p className="muted">Withdrawing ends consideration for this application.</p><button type="button" className="button-quiet resume-remove" disabled={busy} onClick={withdraw}>{busy ? "Please wait..." : "Withdraw application"}</button></div>}
    </div>
  );
}