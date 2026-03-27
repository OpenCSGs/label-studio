/**
 * Editor i18n helper.
 * Editor may render in a separate React root (e.g. DataManager labeling view),
 * so useTranslation() context might not be available.
 * Use the global i18n instance set by the Label Studio app when available.
 */
import { useState, useEffect } from "react";

declare global {
  interface Window {
    __LABELSTUDIO_I18N__?: { t: (key: string) => string; on?: (e: string, cb: () => void) => void; off?: (e: string, cb: () => void) => void };
  }
}

export const useEditorT = (): ((key: string) => string) => {
  const [, forceUpdate] = useState(0);
  const appI18n = typeof window !== "undefined" ? window.__LABELSTUDIO_I18N__ : undefined;

  useEffect(() => {
    if (appI18n?.on) {
      const handler = () => forceUpdate((n) => n + 1);
      appI18n.on("languageChanged", handler);
      return () => {
        appI18n.off?.("languageChanged", handler);
      };
    }
  }, [appI18n]);

  return appI18n?.t
    ? (key: string, options?: Record<string, unknown>) => (appI18n!.t as any)(key, options)
    : (key: string) => key;
};
