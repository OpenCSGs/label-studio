import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enTranslations from '../locales/en.json';
import zhTranslations from '../locales/zh.json';

// 从sessionStorage或URL参数中获取语言
const getLanguageFromStorage = (): string => {
  // 优先从sessionStorage获取
  const storedLang = sessionStorage.getItem('language');
  if (storedLang) {
    return storedLang;
  }
  
  // 从URL参数获取
  const urlParams = new URLSearchParams(window.location.search);
  const langParam = urlParams.get('lang') || urlParams.get('language');
  if (langParam) {
    sessionStorage.setItem('language', langParam);
    return langParam;
  }
  
  // 默认返回浏览器语言或英文
  return navigator.language.startsWith('zh') ? 'zh' : 'en';
};

const language = getLanguageFromStorage();

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: enTranslations as any,
      },
      zh: {
        translation: zhTranslations as any,
      },
    },
    lng: language,
    fallbackLng: 'en',
    returnEmptyString: false,
    returnNull: false,
    interpolation: {
      escapeValue: false, // React已经转义了
    },
    detection: {
      order: ['sessionStorage', 'querystring', 'navigator'],
      lookupSessionStorage: 'language',
      caches: ['sessionStorage'],
    },
  });

// 监听语言变化，更新sessionStorage
i18n.on('languageChanged', (lng) => {
  sessionStorage.setItem('language', lng);
});

export default i18n;
