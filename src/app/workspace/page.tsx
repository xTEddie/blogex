import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import ConnectRepositoriesPage from "@/components/connect-repositories-page";

export default async function WorkspacePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("gh_oauth_token")?.value;

  if (!token) {
    redirect("/");
  }

  return <ConnectRepositoriesPage />;
}
