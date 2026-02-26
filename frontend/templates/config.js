// Use Vite environment variable if available, otherwise fallback to localhost
// For production, you can set this in your deployment platform
export const API_BASE_URL = import.meta.env?.VITE_API_URL || "http://localhost:5000";

export const getApiUrl = (endpoint) => `${API_BASE_URL}${endpoint}`;
 