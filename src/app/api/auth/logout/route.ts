import { NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/auth-cookies";
import { APP_PATHS } from "@/lib/app-paths";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL(APP_PATHS.HOME, request.url), 303);
  return clearAuthCookies(response);
}
