"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import en from "@/i18n/messages/en.json";
import zh from "@/i18n/messages/zh.json";
import {
  DEFAULT_LOCALE,
  detectBrowserLocale,
  LOCALE_STORAGE_KEY,
  resolveLocale,
  type AppLocale,
} from "@/i18n/config";

type Messages = typeof en;

const MESSAGES: Record<AppLocale, Messages> = {
  en,
  zh,
};

interface I18nContextValue {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  messages: Messages;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function getNestedValue(messages: Messages, key: string) {
  return key.split(".").reduce<unknown>((current, part) => {
    if (current && typeof current === "object" && part in current) {
      return (current as Record<string, unknown>)[part];
    }
    return undefined;
  }, messages);
}

function formatMessage(template: string, values?: Record<string, string | number>) {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    values[key] === undefined ? `{${key}}` : String(values[key])
  );
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(DEFAULT_LOCALE);

  useEffect(() => {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    const nextLocale = stored ? resolveLocale(stored) : detectBrowserLocale();
    setLocaleState(nextLocale);
    document.documentElement.lang = nextLocale;
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale: (nextLocale) => {
        const resolved = resolveLocale(nextLocale);
        setLocaleState(resolved);
        window.localStorage.setItem(LOCALE_STORAGE_KEY, resolved);
        document.cookie = `chatclaw-locale=${resolved}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
        document.documentElement.lang = resolved;
      },
      messages: MESSAGES[locale],
    }),
    [locale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useLocale must be used within I18nProvider");
  return ctx.locale;
}

export function useSetLocale() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useSetLocale must be used within I18nProvider");
  return ctx.setLocale;
}

export function useTranslations(namespace?: string) {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useTranslations must be used within I18nProvider");

  return (key: string, values?: Record<string, string | number>) => {
    const fullKey = namespace ? `${namespace}.${key}` : key;
    const message = getNestedValue(ctx.messages, fullKey);
    if (typeof message !== "string") {
      return fullKey;
    }
    return formatMessage(message, values);
  };
}
