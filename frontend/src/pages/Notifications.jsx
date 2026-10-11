import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import Icon from "../components/Icon";
import socket from "../socket";
import { useAuth } from "../context/AuthContext";

export default function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    let active = true;
    api.get("/notifications")
      .then(({ data }) => { if (active) setNotifications(data); })
      .catch((err) => { if (active) setError(err.response?.data?.message || "Could not load notifications."); })
      .finally(() => { if (active) setLoading(false); });

    const handleNotification = (notification) => {
      setNotifications((current) => [notification, ...current.filter((item) => item._id !== notification._id)]);
    };
    socket.on("notification", handleNotification);
    return () => {
      active = false;
      socket.off("notification", handleNotification);
    };
  }, []);

  const markRead = async (notification) => {
    if (notification.readAt) return;
    setUpdatingId(notification._id);
    setError("");
    try {
      const { data } = await api.patch(`/notifications/${notification._id}/read`);
      setNotifications((current) => current.map((item) => item._id === data._id ? data : item));
    } catch (err) {
      setError(err.response?.data?.message || "Could not update this notification.");
    } finally {
      setUpdatingId(null);
    }
  };

  const iconFor = (type) => type === "application_received" ? "users" : type.startsWith("round_") ? "calendar" : "file";

  return (
    <div className="page notifications-page">
      <div className="dashboard-heading"><div><span className="eyebrow">ACCOUNT UPDATES</span><h2>Notifications</h2></div><span className="result-count">{notifications.filter((item) => !item.readAt).length} unread</span></div>
      {error && <p className="error" role="alert">{error}</p>}
      {loading ? <p>Loading notifications...</p> : notifications.length === 0 ? (
        <div className="inline-empty"><span className="metric-icon metric-icon-blue"><Icon name="check" /></span><div><h3>You’re all caught up</h3><p>Application and hiring-round updates will appear here.</p></div></div>
      ) : (
        <div className="notification-list">
          {notifications.map((notification) => (
            <article className={`notification-item${notification.readAt ? " is-read" : " is-unread"}`} key={notification._id}>
              <span className="metric-icon metric-icon-blue"><Icon name={iconFor(notification.type)} /></span>
              <div className="notification-copy">
                <strong>{notification.title}</strong>
                <p>{notification.message}</p>
                <time dateTime={notification.createdAt}>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(notification.createdAt))}</time>
                {notification.application && <Link to={`${user?.role === "student" ? "/my-applications" : "/applications"}/${notification.application}`}>View application</Link>}
              </div>
              {!notification.readAt && <button type="button" className="button-quiet" disabled={updatingId === notification._id} onClick={() => markRead(notification)}>{updatingId === notification._id ? "Saving..." : "Mark read"}</button>}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}