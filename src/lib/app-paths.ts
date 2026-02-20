/**
 * Canonical app route paths.
 * Keep route strings centralized to avoid drift across pages/components/routes.
 */
export const APP_PATHS = {
  HOME: "/",
  USER: "/user",
  WORKSPACE: "/workspace",
  WORKSPACE_SETTINGS: "/workspace/settings",
  AUTH_GITHUB_START: "/api/auth/github",
  AUTH_GITHUB_CALLBACK: "/auth/github/callback",
  AUTH_LOGOUT: "/api/auth/logout",
} as const;
