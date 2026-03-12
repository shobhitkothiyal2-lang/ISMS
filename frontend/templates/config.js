const configuredApiBaseUrl = import.meta.env?.VITE_API_BASE_URL?.trim();
const browserHost = typeof window !== "undefined" ? window.location.hostname : "";

const productionFallbacks = {
  "isms-frontend.onrender.com": "https://isms-backend.onrender.com",
};

const inferredApiBaseUrl =
  productionFallbacks[browserHost] ||
  (typeof window !== "undefined" &&
  browserHost !== "localhost" &&
  browserHost !== "127.0.0.1"
    ? window.location.origin
    : "http://localhost:5000");

export const API_BASE_URL = configuredApiBaseUrl || inferredApiBaseUrl;

export const getApiUrl = (endpoint) => `${API_BASE_URL}${endpoint}`;
 
