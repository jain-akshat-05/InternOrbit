import { useEffect, useState } from "react";
import api from "../api/axios";
import socket from "../socket";

const statusColor = {
  applied: "#888",
  shortlisted: "#2563eb",
  interview: "#a855f7",
  rejected: "#dc2626",
  selected: "#16a34a",
};

export default function MyApplications() {
  const [applications, setApplications] = useState([]);

  useEffect(() => {
    api.get("/applications/mine").then(({ data }) => setApplications(data));

    const handleUpdate = (updated) => {
      setApplications((prev) =>
        prev.map((a) => (a._id === updated._id ? { ...a, status: updated.status } : a))
      );
    };
    socket.on("application_status_update", handleUpdate);
    return () => socket.off("application_status_update", handleUpdate);
  }, []);

  return (
    <div className="page">
      <h2>My Applications</h2>
      <p className="muted">Status updates appear here live — no refresh needed.</p>
      <div className="card-grid">
        {applications.map((a) => (
          <div className="card" key={a._id}>
            <h3>{a.internship?.title}</h3>
            <p className="muted">{a.internship?.company}</p>
            <span className="badge" style={{ background: statusColor[a.status] }}>
              {a.status}
            </span>
          </div>
        ))}
        {applications.length === 0 && <p>You haven't applied to anything yet.</p>}
      </div>
    </div>
  );
}
