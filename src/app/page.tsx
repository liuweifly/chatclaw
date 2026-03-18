"use client";

import { useState } from "react";
import { StoreProvider } from "@/lib/store";
import { CompanySidebar } from "@/components/company-sidebar";
import { NavigationPanel } from "@/components/navigation-panel";
import { LandingPage } from "@/components/landing-page";
import { WorkspaceMain } from "@/components/workspace-main";

export default function Home() {
  const [entered, setEntered] = useState(false);

  if (!entered) {
    return <LandingPage onEnter={() => setEntered(true)} />;
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
