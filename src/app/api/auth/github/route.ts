import { NextResponse } from "next/server";

const OAUTH_STATE_COOKIE = "gh_oauth_state";
const CALLBACK_PATH = "/auth/github/callback";

function getAppUrl(request: Request): string {
  const configured =
    process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  return new URL(request.url).origin;
}

export async function GET(request: Request) {
  const clientId = process.env.GITHUB_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json(
      { error: "Missing GITHUB_CLIENT_ID environment variable." },
      { status: 500 },
    );
  }

  const appUrl = getAppUrl(request);
  const redirectUri = `${appUrl}${CALLBACK_PATH}`;
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "read:user user:email",
    state,
    allow_signup: "true",
  });

  const authorizeUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;
  const response = NextResponse.redirect(authorizeUrl);

  response.cookies.set({
    name: OAUTH_STATE_COOKIE,
    value: state,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });

  return response;
}
