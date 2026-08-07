import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en";
import sr from "./locales/sr";

export const LANGUAGE_STORAGE_KEY = "tripbuddy-language";
export const supportedLanguages = ["en", "sr"] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

function isSupportedLanguage(value: string | null): value is SupportedLanguage {
  return supportedLanguages.includes(value as SupportedLanguage);
}

function resolveInitialLanguage(): SupportedLanguage {
  const storedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);

  if (isSupportedLanguage(storedLanguage)) {
    return storedLanguage;
  }

  return navigator.language.toLowerCase().startsWith("sr") ? "sr" : "en";
}

export function getFormattingLocale(language = i18n.resolvedLanguage): string {
  return language === "sr" ? "sr-Latn-RS" : "en-US";
}

export function applyDocumentLanguage(language = i18n.resolvedLanguage) {
  document.documentElement.lang = language === "sr" ? "sr-Latn" : "en";
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    sr: { translation: sr },
  },
  lng: resolveInitialLanguage(),
  fallbackLng: "en",
  supportedLngs: [...supportedLanguages],
  load: "languageOnly",
  interpolation: { escapeValue: false },
  initAsync: false,
});

applyDocumentLanguage();

i18n.on("languageChanged", (language) => {
  const normalizedLanguage: SupportedLanguage = language.startsWith("sr") ? "sr" : "en";
  localStorage.setItem(LANGUAGE_STORAGE_KEY, normalizedLanguage);
  applyDocumentLanguage(normalizedLanguage);
});

export default i18n;
