import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const initials = user?.name
    ?.trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const closeMenu = () => setMenuOpen(false);

  const handleLogout = () => {
    logout();
    closeMenu();
    navigate("/login");
  };

  return (
    <header className="site-header">
      <nav className="navbar" aria-label="Main navigation">
        <div className="navbar-inner">
          <Link to="/" className="brand" onClick={closeMenu}>
            <span className="brand-mark" aria-hidden="true"><span /></span>
            <span>InternOrbit</span>
          </Link>

          <button
            className={`menu-toggle${menuOpen ? " is-open" : ""}`}
            type="button"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-controls="primary-navigation"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="menu-icon" aria-hidden="true"><i /><i /></span>
          </button>

          <div id="primary-navigation" className={`nav-panel${menuOpen ? " is-open" : ""}`}>
            <div className="nav-links">
              <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`} onClick={closeMenu}>
                Internships
              </NavLink>
              {user?.role === "student" && (
                <NavLink to="/my-applications" className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`} onClick={closeMenu}>
                  My applications
                </NavLink>
              )}
              {user && (
                <NavLink to="/notifications" className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`} onClick={closeMenu}>
                  Updates
                </NavLink>
              )}
              {(user?.role === "student" || user?.role === "recruiter") && (
                <NavLink to="/profile" className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`} onClick={closeMenu}>
                  {user.role === "recruiter" ? "Company profile" : "My Profile"}
                </NavLink>
              )}
              {(user?.role === "recruiter" || user?.role === "admin") && (
                <NavLink to="/recruiter" className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`} onClick={closeMenu}>
                  Recruiter dashboard
                </NavLink>
              )}
              {user?.role === "admin" && (
                <NavLink to="/admin" className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`} onClick={closeMenu}>
                  Admin
                </NavLink>
              )}
            </div>

            <div className="nav-account">
              {user ? (
                <>
                  <div className="profile-summary">
                    <span className="profile-avatar" aria-hidden="true">{initials}</span>
                    <span className="profile-copy">
                      <span className="profile-name">{user.name}</span>
                      <span className="profile-role">{user.role}</span>
                    </span>
                  </div>
                  <button className="button button-quiet logout-button" type="button" onClick={handleLogout}>
                    Log out
                  </button>
                </>
              ) : (
                <>
                  <NavLink to="/login" className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`} onClick={closeMenu}>
                    Log in
                  </NavLink>
                  <NavLink to="/register" className={({ isActive }) => `button button-primary${isActive ? " is-active" : ""}`} onClick={closeMenu}>
                    Create account
                  </NavLink>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}
