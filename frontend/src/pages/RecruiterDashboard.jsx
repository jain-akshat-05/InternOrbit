
import { useEffect, useState } from "react";
import api from "../api/axios";
import socket from "../socket";

const STATUS_OPTIONS = [
  "applied",
  "shortlisted",
  "interview",
  "rejected",
  "selected",
];

const EMPTY_FORM = {
  title: "",
  company: "",
  description: "",
  location: "Remote",
  stipend: 0,
  duration: "3 months",
  skillsRequired: "",
};

export default function RecruiterDashboard() {
  const [myInternships, setMyInternships] = useState([]);
  const [applications, setApplications] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = async () => {
    try {
      setError("");

      const [i, a] = await Promise.all([
        api.get("/internships/recruiter/mine"),
        api.get("/applications/received"),
      ]);

      setMyInternships(i.data);
      setApplications(a.data);
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to load recruiter data."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleNew = (application) => {
      setApplications((prev) => [application, ...prev]);
    };

    socket.on("new_application", handleNew);

    return () => socket.off("new_application", handleNew);
  }, []);

  const handleFormChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: name === "stipend" ? Number(value) : value,
    }));
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const handlePost = async (e) => {
    e.preventDefault();

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      const payload = {
        ...form,
        skillsRequired: form.skillsRequired
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };

      if (editingId) {
        const response = await api.put(
          `/internships/${editingId}`,
          payload
        );

        setMyInternships((prev) =>
          prev.map((internship) =>
            internship._id === editingId
              ? response.data
              : internship
          )
        );

        setSuccess("Internship updated successfully.");
      } else {
        const response = await api.post("/internships", payload);

        setMyInternships((prev) => [response.data, ...prev]);

        setSuccess("Internship posted successfully.");
      }

      resetForm();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          `Failed to ${editingId ? "update" : "post"} internship.`
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (internship) => {
    setEditingId(internship._id);

    setForm({
      title: internship.title || "",
      company: internship.company || "",
      description: internship.description || "",
      location: internship.location || "Remote",
      stipend: internship.stipend || 0,
      duration: internship.duration || "3 months",
      skillsRequired: Array.isArray(internship.skillsRequired)
        ? internship.skillsRequired.join(", ")
        : internship.skillsRequired || "",
    });

    setError("");
    setSuccess("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const handleDelete = async (id) => {
    const confirmed = window.confirm(
      "Archive this internship? Existing applications and their history will be preserved."
    );

    if (!confirmed) return;

    try {
      setDeletingId(id);
      setError("");
      setSuccess("");

      await api.delete(`/internships/${id}`);

      setMyInternships((prev) =>
        prev.map((internship) =>
          internship._id === id ? { ...internship, isActive: false } : internship
        )
      );

      if (editingId === id) {
        resetForm();
      }

      setSuccess("Internship archived. Existing application history was preserved.");
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to archive internship."
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleReactivate = async (id) => {
    try {
      setDeletingId(id);
      setError("");
      setSuccess("");

      await api.put(`/internships/${id}`, { isActive: true });

      setMyInternships((prev) =>
        prev.map((internship) =>
          internship._id === id ? { ...internship, isActive: true } : internship
        )
      );
      setSuccess("Internship reactivated and visible to students.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to reactivate internship.");
    } finally {
      setDeletingId(null);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      setUpdatingStatusId(id);
      setError("");

      await api.put(`/applications/${id}/status`, { status });

      setApplications((prev) =>
        prev.map((a) =>
          a._id === id ? { ...a, status } : a
        )
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to update application status."
      );
    } finally {
      setUpdatingStatusId(null);
    }
  };

  return (
    <div className="page">
      <h2>Recruiter Dashboard</h2>

      {error && (
        <p className="error">
          {error}
        </p>
      )}

      {success && (
        <p className="success">
          ✓ {success}
        </p>
      )}

      <h3>
        {editingId ? "Edit Internship" : "Post a new internship"}
      </h3>

      <form onSubmit={handlePost} className="form-grid">
        <input
          name="title"
          placeholder="Title"
          value={form.title}
          onChange={handleFormChange}
          required
        />

        <input
          name="company"
          placeholder="Company"
          value={form.company}
          onChange={handleFormChange}
          required
        />

        <input
          name="location"
          placeholder="Location"
          value={form.location}
          onChange={handleFormChange}
        />

        <input
          name="stipend"
          type="number"
          placeholder="Stipend"
          value={form.stipend}
          onChange={handleFormChange}
        />

        <input
          name="duration"
          placeholder="Duration"
          value={form.duration}
          onChange={handleFormChange}
        />

        <input
          name="skillsRequired"
          placeholder="Skills (comma separated)"
          value={form.skillsRequired}
          onChange={handleFormChange}
        />

        <textarea
          name="description"
          placeholder="Description"
          value={form.description}
          onChange={handleFormChange}
          required
        />

        <button type="submit" disabled={submitting}>
          {submitting
            ? editingId
              ? "Updating..."
              : "Posting..."
            : editingId
            ? "Update Internship"
            : "Post Internship"}
        </button>

        {editingId && (
          <button
            type="button"
            onClick={resetForm}
            disabled={submitting}
          >
            Cancel Edit
          </button>
        )}
      </form>

      <h3>My Postings ({myInternships.length})</h3>

      {loading ? (
        <p>Loading internships...</p>
      ) : (
        <div className="card-grid">
          {myInternships.map((i) => (
            <div className="card" key={i._id}>
              <h4>{i.title}</h4>

              <p className="muted">
                {i.location} • ₹{i.stipend}
              </p>
              <p>
                <span className={`badge ${i.isActive ? "badge-active" : "badge-archived"}`}>
                  {i.isActive ? "Active" : "Archived"}
                </span>
              </p>

              <div>
                <button
                  type="button"
                  onClick={() => handleEdit(i)}
                  disabled={deletingId === i._id}
                >
                  Edit
                </button>

                <button
                  type="button"
                  onClick={() => i.isActive ? handleDelete(i._id) : handleReactivate(i._id)}
                  disabled={deletingId === i._id}
                  className={i.isActive ? "archive-button" : "reactivate-button"}
                >
                  {deletingId === i._id
                    ? i.isActive ? "Archiving..." : "Reactivating..."
                    : i.isActive ? "Archive" : "Reactivate"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h3>Applications Received</h3>

      <table className="table">
        <thead>
          <tr>
            <th>Student</th>
            <th>Internship</th>
            <th>Status</th>
            <th>Update</th>
          </tr>
        </thead>

        <tbody>
          {applications.map((a) => (
            <tr key={a._id}>
              <td>
                {a.student?.name}
                <br />
                <span className="muted">
                  {a.student?.email}
                </span>
              </td>

              <td>{a.internship?.title}</td>

              <td>{a.status}</td>

              <td>
                <select
                  value={a.status}
                  disabled={updatingStatusId === a._id}
                  onChange={(e) =>
                    updateStatus(a._id, e.target.value)
                  }
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                {updatingStatusId === a._id && (
                  <span className="muted">
                    Updating...
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {applications.length === 0 && (
        <p>No applications yet.</p>
      )}
    </div>
  );
}

