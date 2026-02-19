import { NextResponse } from "next/server";

export function clearAuthCookies(response: NextResponse) {
  response.cookies.delete("gh_oauth_token");
  response.cookies.delete("gh_oauth_state");
  return response;
}
