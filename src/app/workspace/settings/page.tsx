import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import WorkspaceSettingsPage from "@/components/workspace-settings-page";

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("gh_oauth_token")?.value;

  if (!token) {
    redirect("/");
  }

  return <WorkspaceSettingsPage />;
}
