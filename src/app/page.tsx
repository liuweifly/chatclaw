"use client";

import { useState } from "react";
import { StoreProvider } from "@/lib/store";
import { CompanySidebar } from "@/components/company-sidebar";
import { NavigationPanel } from "@/components/navigation-panel";
import { ChatArea } from "@/components/chat-area";
import { LandingPage } from "@/components/landing-page";

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
        <ChatArea />
      </div>
    </StoreProvider>
  );
}
