// Local storage keys and TTL values for client-side cached workspace data.
// Keeping these centralized prevents key drift across pages/components.

export const CONNECT_SESSION_KEY = "blogex:connect-session";
export const CONNECT_SESSION_TTL_MS = 1000 * 60 * 60 * 24;

export const REPOSITORY_CACHE_KEY = "blogex:repositories-cache";
export const REPOSITORY_CACHE_TTL_MS = 1000 * 60 * 60 * 12;
