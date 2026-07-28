import { useEffect, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function InternshipList() {
  const [internships, setInternships] = useState([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const { user } = useAuth();

  const fetchInternships = async () => {
    const { data } = await api.get("/internships", { params: { search } });
    setInternships(data);
  };

  useEffect(() => {
    fetchInternships();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchInternships();
  };

  const applyTo = async (internshipId) => {
    setMessage("");
    try {
      await api.post("/applications", { internshipId });
      setMessage("Applied successfully!");
    } catch (err) {
      setMessage(err.response?.data?.message || "Failed to apply");
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
      <div className="card-grid">
        {internships.map((i) => (
          <div className="card" key={i._id}>
            <h3>{i.title}</h3>
            <p className="muted">{i.company} • {i.location}</p>
            <p>{i.description}</p>
            <p className="muted">Stipend: ₹{i.stipend} | Duration: {i.duration}</p>
            <p className="tags">{i.skillsRequired?.join(", ")}</p>
            {user?.role === "student" && (
              <button onClick={() => applyTo(i._id)}>Apply</button>
            )}
          </div>
        ))}
        {internships.length === 0 && <p>No internships found.</p>}
      </div>
    </div>
  );
}
