import { NextResponse } from "next/server";

export const OAUTH_TOKEN_COOKIE = "gh_oauth_token";
export const OAUTH_STATE_COOKIE = "gh_oauth_state";

export const OAUTH_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 12;
export const OAUTH_STATE_MAX_AGE_SECONDS = 60 * 10;

function isSecureCookie() {
  return process.env.NODE_ENV === "production";
}

export function setOAuthStateCookie(response: NextResponse, state: string) {
  response.cookies.set({
    name: OAUTH_STATE_COOKIE,
    value: state,
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureCookie(),
    path: "/",
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
  });
}

export function clearOAuthStateCookie(response: NextResponse) {
  response.cookies.set({
    name: OAUTH_STATE_COOKIE,
    value: "",
    path: "/",
    maxAge: 0,
  });
}

export function setOAuthTokenCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: OAUTH_TOKEN_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureCookie(),
    path: "/",
    maxAge: OAUTH_TOKEN_MAX_AGE_SECONDS,
  });
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.delete(OAUTH_TOKEN_COOKIE);
  response.cookies.delete(OAUTH_STATE_COOKIE);
  return response;
}
