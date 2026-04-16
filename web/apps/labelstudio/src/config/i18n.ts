import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import enTranslations from "../locales/en.json";
import zhTranslations from "../locales/zh.json";
import heidiTipsZh from "../locales/heidiTips/zh.json";

// 从 sessionStorage 或 URL 参数中获取语言
const getLanguageFromStorage = (): string => {
  const storedLang = sessionStorage.getItem("language");
  if (storedLang) {
    return storedLang;
  }
  const urlParams = new URLSearchParams(window.location.search);
  const langParam = urlParams.get("lang") || urlParams.get("language");
  if (langParam) {
    sessionStorage.setItem("language", langParam);
    return langParam;
  }
  return navigator.language.startsWith("zh") ? "zh" : "en";
};

const language = getLanguageFromStorage();

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslations as Record<string, unknown> },
      zh: {
        translation: {
          ...(zhTranslations as Record<string, unknown>),
          heidiTips: heidiTipsZh,
        },
      },
    },
    lng: language,
    fallbackLng: "en",
    returnEmptyString: false,
    returnNull: false,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["sessionStorage", "querystring", "navigator"],
      lookupSessionStorage: "language",
      caches: ["sessionStorage"],
    },
  });

i18n.on("languageChanged", (lng) => {
  sessionStorage.setItem("language", lng);
});

// 供 editor 等子应用使用（可能在独立 React 根中渲染，无法获取 context）
if (typeof window !== "undefined") {
  (window as any).__LABELSTUDIO_I18N__ = i18n;
}

export default i18n;
