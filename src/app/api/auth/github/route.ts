import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-errors";
import { setOAuthStateCookie } from "@/lib/auth-cookies";
import {
  GITHUB_OAUTH_CALLBACK_PATH,
  GITHUB_OAUTH_SCOPE,
} from "@/lib/oauth-config";

function getAppUrl(request: NextRequest): string {
  return request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const clientId = process.env.GITHUB_CLIENT_ID;

  if (!clientId) {
    return jsonError("MISSING_GITHUB_CLIENT_ID");
  }

  const appUrl = getAppUrl(request);
  const redirectUri = `${appUrl}${GITHUB_OAUTH_CALLBACK_PATH}`;
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: GITHUB_OAUTH_SCOPE,
    state,
    allow_signup: "true",
  });

  const authorizeUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;
  const response = NextResponse.redirect(authorizeUrl);

  setOAuthStateCookie(response, state);

  return response;
}
