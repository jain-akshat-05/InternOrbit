import { useEffect, useState } from "react";
import api from "../api/axios";
import socket from "../socket";

const STATUS_OPTIONS = ["applied", "shortlisted", "interview", "rejected", "selected"];

export default function RecruiterDashboard() {
  const [myInternships, setMyInternships] = useState([]);
  const [applications, setApplications] = useState([]);
  const [form, setForm] = useState({
    title: "", company: "", description: "", location: "Remote",
    stipend: 0, duration: "3 months", skillsRequired: "",
  });

  const loadData = async () => {
    const [i, a] = await Promise.all([
      api.get("/internships/recruiter/mine"),
      api.get("/applications/received"),
    ]);
    setMyInternships(i.data);
    setApplications(a.data);
  };

  useEffect(() => {
    loadData();
    const handleNew = (application) => setApplications((prev) => [application, ...prev]);
    socket.on("new_application", handleNew);
    return () => socket.off("new_application", handleNew);
  }, []);

  const handlePost = async (e) => {
    e.preventDefault();
    await api.post("/internships", {
      ...form,
      skillsRequired: form.skillsRequired.split(",").map((s) => s.trim()).filter(Boolean),
    });
    setForm({ title: "", company: "", description: "", location: "Remote", stipend: 0, duration: "3 months", skillsRequired: "" });
    loadData();
  };

  const updateStatus = async (id, status) => {
    await api.put(`/applications/${id}/status`, { status });
    setApplications((prev) => prev.map((a) => (a._id === id ? { ...a, status } : a)));
  };

  return (
    <div className="page">
      <h2>Recruiter Dashboard</h2>

      <h3>Post a new internship</h3>
      <form onSubmit={handlePost} className="form-grid">
        <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        <input placeholder="Company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} required />
        <input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
        <input type="number" placeholder="Stipend" value={form.stipend} onChange={(e) => setForm({ ...form, stipend: Number(e.target.value) })} />
        <input placeholder="Duration" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
        <input placeholder="Skills (comma separated)" value={form.skillsRequired} onChange={(e) => setForm({ ...form, skillsRequired: e.target.value })} />
        <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
        <button type="submit">Post Internship</button>
      </form>

      <h3>My Postings ({myInternships.length})</h3>
      <div className="card-grid">
        {myInternships.map((i) => (
          <div className="card" key={i._id}>
            <h4>{i.title}</h4>
            <p className="muted">{i.location} • ₹{i.stipend}</p>
          </div>
        ))}
      </div>

      <h3>Applications Received</h3>
      <table className="table">
        <thead>
          <tr><th>Student</th><th>Internship</th><th>Status</th><th>Update</th></tr>
        </thead>
        <tbody>
          {applications.map((a) => (
            <tr key={a._id}>
              <td>{a.student?.name}<br /><span className="muted">{a.student?.email}</span></td>
              <td>{a.internship?.title}</td>
              <td>{a.status}</td>
              <td>
                <select value={a.status} onChange={(e) => updateStatus(a._id, e.target.value)}>
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {applications.length === 0 && <p>No applications yet.</p>}
    </div>
  );
}
