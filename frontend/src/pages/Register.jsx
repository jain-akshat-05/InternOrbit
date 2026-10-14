import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/axios";
import { getApiErrorMessage } from "../api/errors";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "student", company: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { data } = await api.post("/auth/register", form);
      login(data);
      navigate("/");
    } catch (err) {
      setError(getApiErrorMessage(err, "Registration failed. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-layout">
      <aside className="auth-visual">
        <img src="/images/career-growth.svg" alt="A student preparing an application beside a career opportunity checklist" />
        <div className="auth-visual-copy">
          <span className="eyebrow">ROOM TO GROW</span>
          <h2>Build experience that moves you forward.</h2>
          <p>Connect your curiosity with teams ready to help you make an impact.</p>
        </div>
      </aside>
      <section className="auth-panel" aria-labelledby="register-title">
        <div className="auth-card">
          <span className="auth-kicker">GET STARTED</span>
          <h2 id="register-title">Create your account</h2>
          <p className="auth-intro">Choose the path that fits your next step.</p>
          {error && <p className="error" role="alert">{error}</p>}
          <form onSubmit={handleSubmit}>
            <input
              aria-label="Full name"
              placeholder="Full name"
              maxLength={100}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
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
              minLength={6}
              maxLength={72}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
            <select aria-label="Account type" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="student">Student</option>
              <option value="recruiter">Recruiter</option>
            </select>
            {form.role === "recruiter" && (
              <input
                aria-label="Company name"
                placeholder="Company name"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
              />
            )}
            <button type="submit" disabled={submitting}>
              {submitting ? "Creating account..." : "Create Account"}
            </button>
          </form>
          <p className="auth-footer">Already have an account? <Link to="/login">Login here</Link></p>
        </div>
      </section>
    </div>
  );
}
