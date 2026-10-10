import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function InternshipList() {
  const [internships, setInternships] = useState([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [applyingId, setApplyingId] = useState(null);
  const { user } = useAuth();

  const fetchInternships = async (query = search) => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/internships", { params: { search: query } });
      setInternships(data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load internships.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInternships();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchInternships(search);
  };

  const applyTo = async (internshipId) => {
    setMessage("");
    setApplyingId(internshipId);
    try {
      await api.post("/applications", { internshipId });
      setMessage("Applied successfully!");
    } catch (err) {
      setMessage(err.response?.data?.message || "Failed to apply");
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <div className="page">
      <h2>Browse Internships</h2>
      <form onSubmit={handleSearch} className="search-bar">
        <input
          placeholder="Search by title, company, or skill"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="submit">Search</button>
      </form>
      {message && <p className="info">{message}</p>}
      {error && <p className="error">{error}</p>}
      <div className="card-grid">
        {internships.map((i) => (
          <div className="card" key={i._id}>
            <h3>{i.title}</h3>
            <p className="muted">{i.company} • {i.location}</p>
            <p>{i.description}</p>
            <p className="muted">Stipend: ₹{i.stipend} | Duration: {i.duration}</p>
            <p className="tags">{i.skillsRequired?.join(", ")}</p>
            {user?.role === "student" && (
              <button disabled={applyingId === i._id} onClick={() => applyTo(i._id)}>
                {applyingId === i._id ? "Applying..." : "Apply"}
              </button>
            )}
            {!user && <Link to="/login">Log in to apply</Link>}
          </div>
        ))}
        {loading && <p>Loading internships...</p>}
        {!loading && !error && internships.length === 0 && <p>No internships found.</p>}
      </div>
    </div>
  );
}
