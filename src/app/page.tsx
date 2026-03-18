"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { StoreProvider } from "@/lib/store";
import { CompanySidebar } from "@/components/company-sidebar";
import { NavigationPanel } from "@/components/navigation-panel";
import { LandingPage } from "@/components/landing-page";
import { WorkspaceMain } from "@/components/workspace-main";

function HomeInner() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (searchParams.get("workspace") === "1") {
      setEntered(true);
    }
  }, [searchParams]);

  if (!entered) {
    return <LandingPage onEnter={() => setEntered(true)} isAuthenticated={!!user} />;
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

export default function Home() {
  return (
    <Suspense fallback={<div className="flex h-screen w-screen items-center justify-center bg-discord-dark text-white">Loading...</div>}>
      <HomeInner />
    </Suspense>
  );
}
