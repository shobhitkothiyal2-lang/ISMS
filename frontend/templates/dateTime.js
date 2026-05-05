export function normalizeIndianDateTime(value) {
  if (!value || value === "NULL") return null;

  const trimmed = String(value).trim();
  if (!trimmed) return null;

  let normalized = trimmed;

  if (normalized.includes(" ") && !normalized.includes("T")) {
    normalized = normalized.replace(" ", "T");
  }

  if (!normalized.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(normalized)) {
    normalized += "+05:30";
  }

  return normalized;
}

export function parseIndianDateTime(value) {
  const normalized = normalizeIndianDateTime(value);
  if (!normalized) return null;

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getIndianDateTimeMs(value) {
  const parsed = parseIndianDateTime(value);
  return parsed ? parsed.getTime() : Number.NEGATIVE_INFINITY;
}

export function formatIndianDateTime(value) {
  const parsed = parseIndianDateTime(value);
  if (!parsed) return "N/A";

  return parsed.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function formatIndianDate(value) {
  const parsed = parseIndianDateTime(value);
  if (!parsed) return "N/A";

  return parsed.toLocaleDateString("en-GB", {
    timeZone: "Asia/Kolkata",
  });
}

export function formatIndianTime(value) {
  const parsed = parseIndianDateTime(value);
  if (!parsed) return null;

  return parsed.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function isLogoutAction(action) {
  const normalized = String(action || "").toLowerCase();
  return (
    normalized.includes("logout") ||
    normalized.includes("log out") ||
    normalized.includes("logged out") ||
    normalized.includes("session completed") ||
    normalized.includes("session end") ||
    normalized.includes("end")
  );
}

function getLoginTimeFromLog(log) {
  if (!log) return null;
  return log.login_time || (!isLogoutAction(log.action) ? log.timestamp : null);
}

function getLogoutTimeFromLog(log) {
  if (!log) return null;
  return log.logout_time || (isLogoutAction(log.action) ? (log.timestamp || log.login_time) : null);
}

export function getLatestLoginTime(logs) {
  let latestValue = null;
  let latestMs = Number.NEGATIVE_INFINITY;

  for (const log of logs || []) {
    const value = getLoginTimeFromLog(log);
    const ms = getIndianDateTimeMs(value);
    if (value && ms > latestMs) {
      latestValue = value;
      latestMs = ms;
    }
  }

  return latestValue;
}

export function getLatestLogoutTime(logs) {
  let latestValue = null;
  let latestMs = Number.NEGATIVE_INFINITY;

  for (const log of logs || []) {
    const value = getLogoutTimeFromLog(log);
    const ms = getIndianDateTimeMs(value);
    if (value && ms > latestMs) {
      latestValue = value;
      latestMs = ms;
    }
  }

  return latestValue;
}
