import { useEffect, useState } from "react";
import api from "../api/axios";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get("/admin/stats").then(({ data }) => setStats(data));
  }, []);

  if (!stats) return <div className="page">Loading analytics...</div>;

  return (
    <div className="page">
      <h2>Admin Dashboard</h2>
      <div className="stat-grid">
        <div className="stat-card"><h3>{stats.totalStudents}</h3><p>Students</p></div>
        <div className="stat-card"><h3>{stats.totalRecruiters}</h3><p>Recruiters</p></div>
        <div className="stat-card"><h3>{stats.totalInternships}</h3><p>Internships Posted</p></div>
        <div className="stat-card"><h3>{stats.totalApplications}</h3><p>Applications</p></div>
      </div>

      <h3>Application Status Breakdown</h3>
      <ul>
        {stats.statusBreakdown.map((s) => (
          <li key={s._id}>{s._id}: {s.count}</li>
        ))}
      </ul>

      <h3>Recruiter Performance</h3>
      <table className="table">
        <thead><tr><th>Recruiter</th><th>Company</th><th>Postings</th></tr></thead>
        <tbody>
          {stats.recruiterPerformance.map((r) => (
            <tr key={r.name + r.company}>
              <td>{r.name}</td><td>{r.company}</td><td>{r.totalPostings}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
