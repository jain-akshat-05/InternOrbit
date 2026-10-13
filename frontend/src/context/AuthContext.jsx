import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { onUnauthorized } from "../api/axios";
import socket from "../socket";
import { clearStoredUser, readStoredUser, storeUser } from "../authStorage";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    return readStoredUser();
  });

  useEffect(() => {
    if (user?.token) {
      socket.auth = { token: user.token };
      socket.connect();
    } else {
      socket.disconnect();
    }
    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id, user?.token]);

  const login = (userData) => {
    storeUser(userData);
    setUser(userData);
  };

  const updateUser = (userData) => {
    setUser((current) => {
      if (!current) return current;
      const updated = { ...current, ...userData };
      storeUser(updated);
      return updated;
    });
  };

  const logout = useCallback(() => {
    clearStoredUser();
    setUser(null);
    socket.disconnect();
  }, []);

  useEffect(() => {
    onUnauthorized(logout);
    return () => onUnauthorized(null);
  }, [logout]);

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
