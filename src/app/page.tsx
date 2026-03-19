"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthModal } from "@/components/auth-modal";
import { useAuth } from "@/components/auth-provider";
import { LandingPage } from "@/components/landing-page";

function HomeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const authRequested = searchParams.get("auth") === "1";
  const nextParam = searchParams.get("next");
  const redirectTo =
    nextParam && nextParam.startsWith("/") ? nextParam : "/dashboard";
  const [manualAuthModalOpen, setManualAuthModalOpen] = useState(false);
  const showAuthModal = !loading && !user && (authRequested || manualAuthModalOpen);

  useEffect(() => {
    if (authRequested && user) {
      router.replace(redirectTo);
    }
  }, [authRequested, redirectTo, router, user]);

  const clearAuthQuery = useCallback(() => {
    if (!authRequested && !searchParams.get("next")) {
      return;
    }

    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.delete("auth");
    nextSearchParams.delete("next");
    const nextQuery = nextSearchParams.toString();

    router.replace(nextQuery ? `/?${nextQuery}` : "/", { scroll: false });
  }, [authRequested, router, searchParams]);

  const handleAuthModalChange = useCallback(
    (open: boolean) => {
      setManualAuthModalOpen(open);

      if (!open && !user) {
        clearAuthQuery();
      }
    },
    [clearAuthQuery, user]
  );

  const handleAuthenticated = useCallback(() => {
    setManualAuthModalOpen(false);
    router.replace(redirectTo);
  }, [redirectTo, router]);

  const handleEnter = useCallback(() => {
    if (user) {
      router.push("/dashboard");
      return;
    }

    setManualAuthModalOpen(true);
  }, [router, user]);

  return (
    <>
      <LandingPage onEnter={handleEnter} isAuthenticated={!!user} />
      <AuthModal
        open={showAuthModal}
        onOpenChange={handleAuthModalChange}
        redirectTo={redirectTo}
        onAuthenticated={handleAuthenticated}
      />
    </>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="flex h-screen w-screen items-center justify-center bg-discord-dark text-white">Loading...</div>}>
      <HomeInner />
    </Suspense>
  );
}
