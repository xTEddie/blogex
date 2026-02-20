import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-errors";
import { setOAuthStateCookie } from "@/lib/auth-cookies";

const CALLBACK_PATH = "/auth/github/callback";

function getAppUrl(request: NextRequest): string {
  return request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const clientId = process.env.GITHUB_CLIENT_ID;

  if (!clientId) {
    return jsonError("MISSING_GITHUB_CLIENT_ID");
  }

  const appUrl = getAppUrl(request);
  const redirectUri = `${appUrl}${CALLBACK_PATH}`;
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "read:user user:email repo",
    state,
    allow_signup: "true",
  });

  const authorizeUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;
  const response = NextResponse.redirect(authorizeUrl);

  setOAuthStateCookie(response, state);

  return response;
}
