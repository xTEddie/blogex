import { NextRequest, NextResponse } from "next/server";

const OAUTH_STATE_COOKIE = "gh_oauth_state";
const OAUTH_TOKEN_COOKIE = "gh_oauth_token";
const CALLBACK_PATH = "/auth/github/callback";

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
    return NextResponse.json(
      {
        error:
          "Missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET environment variable.",
      },
      { status: 500 },
    );
  }

  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const storedState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;

  if (!code || !state || !storedState || state !== storedState) {
    const invalidStateResponse = NextResponse.redirect(
      new URL("/?error=invalid_oauth_state", request.url),
    );
    invalidStateResponse.cookies.set({
      name: OAUTH_STATE_COOKIE,
      value: "",
      path: "/",
      maxAge: 0,
    });
    return invalidStateResponse;
  }

  const appUrl = getAppUrl(request);
  const redirectUri = `${appUrl}${CALLBACK_PATH}`;
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
    oauthFailedResponse.cookies.set({
      name: OAUTH_STATE_COOKIE,
      value: "",
      path: "/",
      maxAge: 0,
    });
    return oauthFailedResponse;
  }

  const response = NextResponse.redirect(new URL("/user", request.url));
  // OAUTH token cookie valid for 12 hours (GitHub tokens do not expire by default, but we set a reasonable max age for the cookie)
  const oauthTokenSystemExpiry = 60 * 60 * 12;
  response.cookies.set({
    name: OAUTH_TOKEN_COOKIE,
    value: tokenData.access_token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: oauthTokenSystemExpiry,
  });

  response.cookies.set({
    name: OAUTH_STATE_COOKIE,
    value: "",
    path: "/",
    maxAge: 0,
  });

  return response;
}
