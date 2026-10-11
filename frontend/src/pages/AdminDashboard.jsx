import { useEffect, useState } from "react";
import api from "../api/axios";
import Icon from "../components/Icon";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const statusRows = stats?.statusBreakdown || [];
  const maximumStatusCount = Math.max(1, ...statusRows.map((status) => status.count));

  useEffect(() => {
    api.get("/admin/stats")
      .then(({ data }) => setStats(data))
      .catch((err) => setError(err.response?.data?.message || "Failed to load analytics."));
  }, []);

  if (error) return <div className="page"><p className="error">{error}</p></div>;
  if (!stats) return <div className="page">Loading analytics...</div>;

  return (
    <div className="page admin-page">
      <div className="dashboard-heading">
        <div><span className="eyebrow">PLATFORM OVERVIEW</span><h2>Admin dashboard</h2></div>
        <p className="muted">Current totals across InternOrbit.</p>
      </div>
      <div className="stat-grid">
        <div className="stat-card"><span className="metric-icon metric-icon-green"><Icon name="users" /></span><div><h3>{stats.totalStudents}</h3><p>Students</p></div></div>
        <div className="stat-card"><span className="metric-icon metric-icon-blue"><Icon name="users" /></span><div><h3>{stats.totalRecruiters}</h3><p>Recruiters</p></div></div>
        <div className="stat-card"><span className="metric-icon metric-icon-lime"><Icon name="briefcase" /></span><div><h3>{stats.totalInternships}</h3><p>Internships posted</p></div></div>
        <div className="stat-card"><span className="metric-icon metric-icon-amber"><Icon name="file" /></span><div><h3>{stats.totalApplications}</h3><p>Applications</p></div></div>
      </div>

      <section className="admin-section" aria-labelledby="admin-status-title">
        <div className="section-heading-compact">
          <div><span className="eyebrow">APPLICATIONS</span><h3 id="admin-status-title">Status breakdown</h3></div>
          <span className="muted">{stats.totalApplications} total</span>
        </div>
        {statusRows.length === 0 ? (
          <p className="chart-empty">Status data will appear when applications are submitted.</p>
        ) : (
          <div className="status-bars admin-status-bars">
            {statusRows.map((status) => (
              <div className="status-bar-row" key={status._id}>
                <span className="status-bar-label">{status._id}</span>
                <span className="status-bar-track"><span className="status-bar-fill" style={{ width: `${(status.count / maximumStatusCount) * 100}%` }} /></span>
                <strong>{status.count}</strong>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="admin-section" aria-labelledby="admin-recruiter-title">
        <div className="section-heading-compact">
          <div><span className="eyebrow">RECRUITER ACTIVITY</span><h3 id="admin-recruiter-title">Recruiter postings</h3></div>
          <span className="muted">{stats.recruiterPerformance.length} recruiters</span>
        </div>
        <table className="table">
          <thead><tr><th>Recruiter</th><th>Company</th><th>Postings</th></tr></thead>
          <tbody>
            {stats.recruiterPerformance.length === 0 ? (
              <tr><td colSpan="3" className="table-empty">Recruiter posting data will appear here.</td></tr>
            ) : stats.recruiterPerformance.map((recruiter) => (
              <tr key={recruiter._id}>
                <td>{recruiter.name}</td><td>{recruiter.company || "—"}</td><td>{recruiter.totalPostings}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
