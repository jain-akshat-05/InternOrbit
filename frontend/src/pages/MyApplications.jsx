import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import socket from "../socket";
import Icon from "../components/Icon";

const statusDetails = {
  applied: { label: "Applied", icon: "file", tone: "badge-neutral" },
  shortlisted: { label: "Shortlisted", icon: "check", tone: "badge-info" },
  assessment: { label: "Assessment", icon: "file", tone: "badge-warning" },
  interview: { label: "Interview", icon: "calendar", tone: "badge-warning" },
  rejected: { label: "Rejected", icon: "xCircle", tone: "badge-danger" },
  selected: { label: "Selected", icon: "check", tone: "badge-success" },
  withdrawn: { label: "Withdrawn", icon: "xCircle", tone: "badge-neutral" },
};

const formatDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
};

export default function MyApplications() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const upcomingRounds = applications.flatMap((application) =>
    (application.upcomingRounds || []).map((round) => ({
      ...round,
      applicationId: application._id,
      internshipTitle: application.internship?.title,
    }))
  );
  const activeApplicationCount = applications.filter((application) => !["selected", "rejected", "withdrawn"].includes(application.status)).length;
  const recentUpdateCount = applications.reduce((total, application) => total + Math.max(0, (application.statusHistory?.length || 0) - 1), 0);

  useEffect(() => {
    let active = true;
    api.get("/applications/mine")
      .then(({ data }) => {
        if (active) setApplications(data);
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.message || "Failed to load applications.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const handleUpdate = (updated) => {
      setApplications((prev) =>
        prev.map((a) => (a._id === updated._id ? { ...a, status: updated.status } : a))
      );
    };
    socket.on("application_status_update", handleUpdate);
    return () => {
      active = false;
      socket.off("application_status_update", handleUpdate);
    };
  }, []);

  return (
    <div className="page">
      <div className="applications-heading">
        <div>
          <span className="eyebrow">YOUR OPPORTUNITIES</span>
          <h2>My applications</h2>
          <p className="muted">Track the latest status of your applications.</p>
        </div>
        {!loading && !error && <span className="result-count">{applications.length} {applications.length === 1 ? "application" : "applications"}</span>}
      </div>
      {error && <p className="error">{error}</p>}
      {!loading && !error && applications.length > 0 && (
        <section className="dashboard-metrics student-metrics" aria-label="Student application metrics">
          <article className="metric-card"><span className="metric-icon metric-icon-blue"><Icon name="file" /></span><div><span className="metric-label">Submitted</span><strong>{applications.length}</strong></div></article>
          <article className="metric-card"><span className="metric-icon metric-icon-green"><Icon name="clock" /></span><div><span className="metric-label">Active</span><strong>{activeApplicationCount}</strong></div></article>
          <article className="metric-card"><span className="metric-icon metric-icon-lime"><Icon name="calendar" /></span><div><span className="metric-label">Upcoming rounds</span><strong>{upcomingRounds.length}</strong></div></article>
          <article className="metric-card"><span className="metric-icon metric-icon-amber"><Icon name="check" /></span><div><span className="metric-label">Status changes</span><strong>{recentUpdateCount}</strong></div></article>
        </section>
      )}
      {!loading && !error && upcomingRounds.length > 0 && (
        <section className="student-upcoming-rounds" aria-labelledby="upcoming-rounds-title">
          <div className="section-heading-compact">
            <div><span className="eyebrow">NEXT STEPS</span><h3 id="upcoming-rounds-title">Upcoming rounds</h3></div>
          </div>
          <div className="upcoming-round-list">
            {upcomingRounds.map((round) => (
              <Link className="upcoming-round-item" to={`/my-applications/${round.applicationId}`} key={`${round.applicationId}-${round._id}`}>
                <span className="application-mark"><Icon name="calendar" size={18} /></span>
                <span><strong>{round.title}</strong><small>{round.internshipTitle}</small></span>
                <time dateTime={round.scheduledAt}>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(round.scheduledAt))}</time>
              </Link>
            ))}
          </div>
        </section>
      )}
      <div className="card-grid application-grid">
        {applications.map((a) => (
          <article className="application-card" key={a._id}>
            <div className="application-card-heading">
              <span className="application-mark" aria-hidden="true"><Icon name="briefcase" size={20} /></span>
              <div className="application-title"><h3><Link to={`/my-applications/${a._id}`}>{a.internship?.title || "Internship"}</Link></h3><p>{a.internship?.company}</p></div>
            </div>
            <div className={`application-status ${statusDetails[a.status]?.tone || "badge-neutral"}`}>
              <Icon name={statusDetails[a.status]?.icon || "file"} size={17} />
              <span>{statusDetails[a.status]?.label || a.status}</span>
            </div>
            <div className="application-card-meta">
              <span>Current status</span>
              {a.createdAt && <time dateTime={a.createdAt}>Applied {formatDate(a.createdAt)}</time>}
            </div>
            <div className="application-card-action"><Link to={`/my-applications/${a._id}`}>View application details</Link></div>
          </article>
        ))}
        {loading && <p>Loading applications...</p>}
        {!loading && !error && applications.length === 0 && (
          <div className="application-empty-state">
            <img src="/images/applications-empty.svg" alt="An application document and a progress clock" />
            <div><span className="eyebrow">READY WHEN YOU ARE</span><h3>Your next opportunity starts here.</h3><p>When you apply, you can follow each update from this page.</p><Link className="button-primary" to="/">Explore internships</Link></div>
          </div>
        )}
      </div>
    </div>
  );
}
