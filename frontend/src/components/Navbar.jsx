import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="navbar">
      <Link to="/" className="brand">InternOrbit</Link>
      <div className="nav-links">
        <Link to="/">Internships</Link>
        {user?.role === "student" && <Link to="/my-applications">My Applications</Link>}
        {(user?.role === "recruiter" || user?.role === "admin") && (
          <Link to="/recruiter">Recruiter Dashboard</Link>
        )}
        {user?.role === "admin" && <Link to="/admin">Admin</Link>}
        {user ? (
          <>
            <span className="user-chip">{user.name} ({user.role})</span>
            <button onClick={handleLogout}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </div>
    </nav>
  );
}
