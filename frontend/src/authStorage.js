const STORAGE_KEY = "internorbit_user";

export function readStoredUser() {
  try {
    const user = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (
      user &&
      typeof user === "object" &&
      typeof user._id === "string" &&
      typeof user.role === "string" &&
      typeof user.token === "string"
    ) {
      return user;
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }

  return null;
}

export function storeUser(user) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

export function clearStoredUser() {
  localStorage.removeItem(STORAGE_KEY);
}