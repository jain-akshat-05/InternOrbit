
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import socket from "../socket";
import Icon from "../components/Icon";

const STATUS_OPTIONS = [
  "applied",
  "shortlisted",
  "assessment",
  "interview",
  "rejected",
  "selected",
];
const STATUS_FILTER_OPTIONS = [
  "applied",
  "shortlisted",
  "assessment",
  "interview",
  "rejected",
  "selected",
  "withdrawn",
];
const NEXT_STATUS_OPTIONS = {
  applied: ["shortlisted", "assessment", "rejected"],
  shortlisted: ["assessment", "interview", "rejected"],
  assessment: ["interview", "rejected"],
  interview: ["selected", "rejected"],
  selected: [],
  rejected: [],
  withdrawn: [],
};

const EMPTY_FORM = {
  title: "",
  company: "",
  description: "",
  location: "Remote",
  stipend: 0,
  duration: "3 months",
  skillsRequired: "",
  applicationQuestions: "",
};

export default function RecruiterDashboard() {
  const [myInternships, setMyInternships] = useState([]);
  const [applications, setApplications] = useState([]);
  const [upcomingRounds, setUpcomingRounds] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [internshipFilter, setInternshipFilter] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const activePostingCount = myInternships.filter((internship) => internship.isActive).length;
  const interviewCount = applications.filter((application) => application.status === "interview").length;
  const statusMaximum = Math.max(1, ...STATUS_FILTER_OPTIONS.map((status) => applications.filter((application) => application.status === status).length));

  const loadData = async () => {
    try {
      setError("");

      const [i, a, rounds] = await Promise.all([
        api.get("/internships/recruiter/mine"),
        api.get("/applications/received"),
        api.get("/rounds/upcoming/recruiter"),
      ]);

      setMyInternships(i.data);
      setApplications(a.data);
      setUpcomingRounds(rounds.data);
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to load recruiter data."
      );
    } finally {
      setLoading(false);
    }
  };

  const applyApplicationFilters = async (event) => {
    event.preventDefault();
    setError("");
    try {
      const { data } = await api.get("/applications/received", {
        params: {
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(internshipFilter ? { internshipId: internshipFilter } : {}),
          sort: sortOrder,
        },
      });
      setApplications(data);
    } catch (err) {
      setError(err.response?.data?.message || "Could not filter applicants.");
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
        applicationQuestions: form.applicationQuestions
          .split("\n")
          .map((question) => question.trim())
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
      applicationQuestions: Array.isArray(internship.applicationQuestions)
        ? internship.applicationQuestions.join("\n")
        : "",
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

      {!loading && !error && (
        <section className="dashboard-metrics" aria-label="Recruiter metrics">
          <article className="metric-card">
            <span className="metric-icon metric-icon-green"><Icon name="briefcase" /></span>
            <div><span className="metric-label">My postings</span><strong>{myInternships.length}</strong></div>
          </article>
          <article className="metric-card">
            <span className="metric-icon metric-icon-lime"><Icon name="check" /></span>
            <div><span className="metric-label">Active listings</span><strong>{activePostingCount}</strong></div>
          </article>
          <article className="metric-card">
            <span className="metric-icon metric-icon-blue"><Icon name="users" /></span>
            <div><span className="metric-label">Applications received</span><strong>{applications.length}</strong></div>
          </article>
          <article className="metric-card">
            <span className="metric-icon metric-icon-amber"><Icon name="clock" /></span>
            <div><span className="metric-label">In interview</span><strong>{interviewCount}</strong></div>
          </article>
        </section>
      )}

      {!loading && !error && upcomingRounds.length > 0 && (
        <section className="status-overview recruiter-upcoming" aria-labelledby="recruiter-upcoming-title">
          <div className="section-heading-compact"><div><span className="eyebrow">SCHEDULE</span><h3 id="recruiter-upcoming-title">Upcoming rounds</h3></div><span className="muted">{upcomingRounds.length} scheduled</span></div>
          <div className="upcoming-round-list">
            {upcomingRounds.slice(0, 5).map((round) => (
              <Link className="upcoming-round-item" key={round._id} to={`/recruiter/internships/${round.internship?._id}/rounds`}>
                <span className="application-mark"><Icon name="calendar" size={18} /></span>
                <span><strong>{round.title}</strong><small>{round.internship?.title}</small></span>
                <time dateTime={round.scheduledAt}>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(round.scheduledAt))}</time>
              </Link>
            ))}
          </div>
        </section>
      )}

      <h3>
        {editingId ? "Edit Internship" : "Post a new internship"}
      </h3>

      <form onSubmit={handlePost} className="form-grid">
        <input
          name="title"
          aria-label="Internship title"
          placeholder="Title"
          value={form.title}
          onChange={handleFormChange}
          required
        />

        <input
          name="company"
          aria-label="Company"
          placeholder="Company"
          value={form.company}
          onChange={handleFormChange}
          required
        />

        <input
          name="location"
          aria-label="Location"
          placeholder="Location"
          value={form.location}
          onChange={handleFormChange}
        />

        <input
          name="stipend"
          aria-label="Stipend"
          type="number"
          placeholder="Stipend"
          value={form.stipend}
          onChange={handleFormChange}
        />

        <input
          name="duration"
          aria-label="Duration"
          placeholder="Duration"
          value={form.duration}
          onChange={handleFormChange}
        />

        <input
          name="skillsRequired"
          aria-label="Required skills, comma separated"
          placeholder="Skills (comma separated)"
          value={form.skillsRequired}
          onChange={handleFormChange}
        />

        <textarea
          name="applicationQuestions"
          aria-label="Application questions, one per line"
          placeholder="Application questions (one per line, up to 10)"
          value={form.applicationQuestions}
          onChange={handleFormChange}
          maxLength={4000}
        />

        <textarea
          name="description"
          aria-label="Internship description"
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
      ) : error ? null : myInternships.length === 0 ? (
        <div className="inline-empty">
          <span className="metric-icon metric-icon-green"><Icon name="briefcase" /></span>
          <div><h4>No postings yet</h4><p>Create an internship above to start receiving applications.</p></div>
        </div>
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
                <Link className="rounds-link" to={`/recruiter/internships/${i._id}/rounds`}>
                  <Icon name="calendar" size={16} />Hiring rounds
                </Link>
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

      {!loading && !error && <section className="status-overview" aria-labelledby="status-overview-title">
        <div className="section-heading-compact">
          <div><span className="eyebrow">LIVE APPLICATIONS</span><h3 id="status-overview-title">Status overview</h3></div>
          <span className="muted">{applications.length} total</span>
        </div>
        {applications.length === 0 ? (
          <p className="chart-empty">Status details will appear when students apply to your postings.</p>
        ) : (
          <div className="status-bars">
            {STATUS_FILTER_OPTIONS.map((status) => {
              const count = applications.filter((application) => application.status === status).length;
              return (
                <div className="status-bar-row" key={status}>
                  <span className="status-bar-label">{status}</span>
                  <span className="status-bar-track"><span className={`status-bar-fill status-fill-${status}`} style={{ width: `${(count / statusMaximum) * 100}%` }} /></span>
                  <strong>{count}</strong>
                </div>
              );
            })}
          </div>
        )}
      </section>}

      <h3>Applications Received</h3>

      <form className="application-filters" onSubmit={applyApplicationFilters}>
        <label>Status<select aria-label="Filter applicants by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All statuses</option>{STATUS_FILTER_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
        <label>Internship<select aria-label="Filter applicants by internship" value={internshipFilter} onChange={(event) => setInternshipFilter(event.target.value)}><option value="">All internships</option>{myInternships.map((internship) => <option key={internship._id} value={internship._id}>{internship.title}</option>)}</select></label>
        <label>Sort<select aria-label="Sort applicants" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label>
        <button type="submit">Apply filters</button>
      </form>

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
          {loading ? (
            <tr><td colSpan="4" className="table-empty">Loading applications...</td></tr>
          ) : error ? (
            <tr><td colSpan="4" className="table-empty">Applications are unavailable.</td></tr>
          ) : applications.length === 0 ? (
            <tr><td colSpan="4" className="table-empty">No applications have been received yet.</td></tr>
          ) : applications.map((a) => (
            <tr key={a._id}>
              <td>
                {a.student?.name}
                <br />
                <span className="muted">
                  {a.student?.email}
                </span>
                <br />
                <Link to={`/applications/${a._id}`}>Review profile</Link>
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
                  {[a.status, ...(NEXT_STATUS_OPTIONS[a.status] || [])].map((s) => (
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
    </div>
  );
}

