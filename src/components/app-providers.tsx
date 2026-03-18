"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/components/auth-provider";
import { I18nProvider } from "@/i18n/provider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <AuthProvider>{children}</AuthProvider>
    </I18nProvider>
  );
}
