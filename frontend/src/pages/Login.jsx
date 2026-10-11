import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { data } = await api.post("/auth/login", form);
      login(data);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-layout">
      <aside className="auth-visual">
        <img src="/images/career-growth.svg" alt="A student preparing an application beside a career opportunity checklist" />
        <div className="auth-visual-copy">
          <span className="eyebrow">YOUR NEXT CHAPTER</span>
          <h2>Turn what you’re learning into what’s next.</h2>
          <p>Find a place to practice your skills, contribute, and grow.</p>
        </div>
      </aside>
      <section className="auth-panel" aria-labelledby="login-title">
        <div className="auth-card">
          <span className="auth-kicker">WELCOME BACK</span>
          <h2 id="login-title">Login</h2>
          <p className="auth-intro">Continue your internship journey.</p>
          {error && <p className="error" role="alert">{error}</p>}
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              aria-label="Email address"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
            <input
              type="password"
              aria-label="Password"
              placeholder="Password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
            <button type="submit" disabled={submitting}>
              {submitting ? "Logging in..." : "Login"}
            </button>
          </form>
          <p className="auth-footer">No account? <Link to="/register">Register here</Link></p>
        </div>
      </section>
    </div>
  );
}
