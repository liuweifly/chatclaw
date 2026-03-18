export const LOCALES = ["en", "zh"] as const;

export type AppLocale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "en";
export const LOCALE_STORAGE_KEY = "chatclaw-locale";

export function resolveLocale(locale: string | null | undefined): AppLocale {
  return locale === "zh" ? "zh" : DEFAULT_LOCALE;
}

export function detectBrowserLocale(): AppLocale {
  if (typeof navigator === "undefined") {
    return DEFAULT_LOCALE;
  }

  const language = navigator.language.toLowerCase();
  return language.startsWith("zh") ? "zh" : DEFAULT_LOCALE;
}
