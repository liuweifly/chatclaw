"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CompanySidebar } from "@/components/company-sidebar";
import { NavigationPanel } from "@/components/navigation-panel";
import { WorkspaceMain } from "@/components/workspace-main";
import { useAuth } from "@/components/auth-provider";
import { StoreProvider } from "@/lib/store";

export function DashboardShell() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, router, user]);

  if (loading || !user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-discord-dark text-white">
        Loading...
      </div>
    );
  }

  return (
    <StoreProvider>
      <div className="flex h-screen w-screen overflow-hidden">
        <CompanySidebar />
        <NavigationPanel />
        <WorkspaceMain />
      </div>
    </StoreProvider>
  );
}
