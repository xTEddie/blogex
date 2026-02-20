import { NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/auth-cookies";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/", request.url), 303);
  return clearAuthCookies(response);
}
