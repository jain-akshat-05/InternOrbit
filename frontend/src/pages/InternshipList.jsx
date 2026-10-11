import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import Icon from "../components/Icon";
import { useAuth } from "../context/AuthContext";

const categoryFor = (internship) => {
  const details = [internship.title, internship.description, ...(internship.skillsRequired || [])]
    .join(" ")
    .toLowerCase();

  if (/\b(design|figma|ui\/ux|ux|visual)\b/.test(details)) return { label: "Design", icon: "palette" };
  if (/\b(data|analytics|analyst|machine learning|\bml\b|statistics)\b/.test(details)) return { label: "Data", icon: "chart" };
  if (/\b(marketing|seo|social media|growth|campaign|content)\b/.test(details)) return { label: "Marketing", icon: "megaphone" };
  if (/\b(developer|development|software|engineer|programming|devops|frontend|backend|web)\b/.test(details)) return { label: "Development", icon: "code" };
  return { label: "Other", icon: "briefcase" };
};

const initialsFor = (company = "") =>
  company.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase() || "CO";

const toneFor = (company = "") => {
  const hash = [...company].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return `company-tone-${(hash % 4) + 1}`;
};

export default function InternshipList() {
  const [internships, setInternships] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
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

  return (
    <div className="page explore-page">
      <section className="explore-hero" aria-labelledby="explore-title">
        <div className="explore-hero-copy">
          <span className="eyebrow">INTERNSHIPS, WITH ROOM TO GROW</span>
          <h1 id="explore-title">Find work that helps you move forward.</h1>
          <p>Explore real openings, bring your skills to a team, and build experience one opportunity at a time.</p>
          <a className="button-primary explore-cta" href="#opportunities">Explore opportunities</a>
        </div>
        <div className="explore-hero-art">
          <img src="/images/opportunity-map.svg" alt="Illustration of an internship search and application milestones" />
        </div>
      </section>

      <section className="explore-results" id="opportunities" aria-labelledby="opportunities-title">
        <div className="results-heading">
          <div>
            <span className="eyebrow">OPEN ROLES</span>
            <h2 id="opportunities-title">Explore internships</h2>
          </div>
          {!loading && !error && <p className="result-count">{internships.length} {internships.length === 1 ? "opportunity" : "opportunities"}</p>}
        </div>
        <form onSubmit={handleSearch} className="search-bar">
          <label className="search-field">
            <Icon name="search" size={19} />
            <input
              type="search"
              aria-label="Search internships by title, company, or skill"
              placeholder="Search by title, company, or skill"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <button type="submit">Search</button>
        </form>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="card-grid internship-grid">
        {internships.map((i) => (
          <article className="internship-card" key={i._id}>
            <div className="internship-card-top">
              <div className={`company-avatar ${toneFor(i.company)}`} aria-label={`${i.company} initials`}>
                {initialsFor(i.company)}
              </div>
              {(() => {
                const category = categoryFor(i);
                return <span className="category-label"><Icon name={category.icon} size={15} />{category.label}</span>;
              })()}
            </div>
            <h3>{i.title}</h3>
            <p className="internship-company">{i.company}<span aria-hidden="true">·</span>{i.location}</p>
            <p className="internship-description">{i.description}</p>
            <div className="internship-facts">
              <span><small>Stipend</small><strong>₹{i.stipend}</strong></span>
              <span><small>Duration</small><strong>{i.duration}</strong></span>
            </div>
            {i.skillsRequired?.length > 0 && (
              <div className="skill-list" aria-label="Required skills">
                {i.skillsRequired.map((skill, index) => <span className="skill-chip" key={`${skill}-${index}`}>{skill}</span>)}
              </div>
            )}
            <div className="internship-card-footer">
              <Link className="button-primary" to={`/internships/${i._id}`}>
                {user?.role === "student" ? "View and apply" : "View details"}
              </Link>
            </div>
          </article>
        ))}
        {loading && <p>Loading internships...</p>}
        {!loading && !error && internships.length === 0 && (
          <div className="empty-opportunities">
            <img src="/images/opportunity-map.svg" alt="" />
            <div><h3>No internships found</h3><p>Try another title, company, or skill.</p></div>
          </div>
        )}
        </div>
      </section>
    </div>
  );
}
