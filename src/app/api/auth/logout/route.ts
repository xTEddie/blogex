import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/", request.url), 303);

  response.cookies.delete("gh_oauth_token");
  response.cookies.delete("gh_oauth_state");

  return response;
}
