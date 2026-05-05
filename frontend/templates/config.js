const configuredApiBaseUrl = import.meta.env?.VITE_API_BASE_URL?.trim();
const browserHost = typeof window !== "undefined" ? window.location.hostname : "";
const isLocalHost = browserHost === "localhost" || browserHost === "127.0.0.1";

const inferredApiBaseUrl =
  typeof window !== "undefined"
    ? isLocalHost
      ? "http://localhost:5000"
      : window.location.origin
    : "http://localhost:5000";

export const API_BASE_URL = (configuredApiBaseUrl || inferredApiBaseUrl).replace(/\/$/, "");

export const getApiUrl = (endpoint) => `${API_BASE_URL}${endpoint}`;
 
