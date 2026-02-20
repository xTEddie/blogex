import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import WorkspaceSettingsPage from "@/components/workspace-settings-page";
import { OAUTH_TOKEN_COOKIE } from "@/lib/auth-cookies";

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(OAUTH_TOKEN_COOKIE)?.value;

  if (!token) {
    redirect("/");
  }

  return <WorkspaceSettingsPage />;
}
