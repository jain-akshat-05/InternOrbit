import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="page">
      <div className="inline-empty">
        <div>
          <span className="eyebrow">PAGE NOT FOUND</span>
          <h2>This page does not exist.</h2>
          <p>The link may be typed incorrectly, or the page may have moved.</p>
          <Link className="button-primary" to="/">
            Back to internships
          </Link>
        </div>
      </div>
    </div>
  );
}
