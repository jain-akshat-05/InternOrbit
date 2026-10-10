import { createContext, useContext, useEffect, useState } from "react";
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

  const logout = () => {
    clearStoredUser();
    setUser(null);
    socket.disconnect();
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
