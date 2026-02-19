import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/", request.url));

  response.cookies.set({
    name: "gh_oauth_token",
    value: "",
    path: "/",
    maxAge: 0,
  });

  response.cookies.set({
    name: "gh_oauth_state",
    value: "",
    path: "/",
    maxAge: 0,
  });

  return response;
}
