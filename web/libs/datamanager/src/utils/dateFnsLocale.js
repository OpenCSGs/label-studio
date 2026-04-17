import { format } from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import { zhCN } from "date-fns/locale/zh-CN";

/**
 * Matches Label Studio app language (see web/apps/labelstudio/src/config/i18n.ts).
 * Supports `zh`, `zh-CN`, and i18next `resolvedLanguage`.
 */
export function getAppDateFnsLocale() {
  if (typeof window === "undefined") return enUS;
  const i18n = window.__LABELSTUDIO_I18N__;
  if (!i18n) return enUS;
  const lng = i18n.resolvedLanguage || i18n.language;
  if (!lng) return enUS;
  return String(lng).toLowerCase().startsWith("zh") ? zhCN : enUS;
}

/** English table pattern; Chinese uses explicit 年/月/日 so month names are never "Apr". */
export const dateTimeFormatEn = "MMM dd yyyy, HH:mm:ss";

/**
 * Formats a date for data manager table cells (completed_at, etc.).
 */
export function formatTableDateTime(date) {
  const locale = getAppDateFnsLocale();
  const pattern = locale === zhCN ? "yyyy年M月d日 HH:mm:ss" : dateTimeFormatEn;
  return format(date, pattern, { locale });
}
