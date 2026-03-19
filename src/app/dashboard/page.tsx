import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { getServerUser } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const user = await getServerUser();

  if (!user) {
    redirect("/?auth=1&next=%2Fdashboard");
  }

  return <DashboardShell />;
}
