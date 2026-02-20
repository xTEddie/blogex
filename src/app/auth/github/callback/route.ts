import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-errors";
import {
  OAUTH_STATE_COOKIE,
  clearOAuthStateCookie,
  setOAuthTokenCookie,
} from "@/lib/auth-cookies";
import { GITHUB_OAUTH_CALLBACK_PATH } from "@/lib/oauth-config";

type GithubTokenResponse = {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

function getAppUrl(request: NextRequest): string {
  return request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return jsonError("MISSING_GITHUB_OAUTH_ENV");
  }

  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const storedState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;

  if (!code || !state || !storedState || state !== storedState) {
    const invalidStateResponse = NextResponse.redirect(
      new URL("/?error=invalid_oauth_state", request.url),
    );
    clearOAuthStateCookie(invalidStateResponse);
    return invalidStateResponse;
  }

  const appUrl = getAppUrl(request);
  const redirectUri = `${appUrl}${GITHUB_OAUTH_CALLBACK_PATH}`;
  const tokenParams = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    state,
  });

  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: tokenParams.toString(),
    cache: "no-store",
  });

  const tokenData = (await tokenResponse.json()) as GithubTokenResponse;

  if (!tokenResponse.ok || !tokenData.access_token) {
    const oauthFailedResponse = NextResponse.redirect(
      new URL("/?error=oauth_exchange_failed", request.url),
    );
    clearOAuthStateCookie(oauthFailedResponse);
    return oauthFailedResponse;
  }

  const response = NextResponse.redirect(new URL("/user", request.url));
  // GitHub OAuth tokens do not expire by default; we cap the cookie lifetime to keep sessions bounded.
  setOAuthTokenCookie(response, tokenData.access_token);
  clearOAuthStateCookie(response);

  return response;
}
