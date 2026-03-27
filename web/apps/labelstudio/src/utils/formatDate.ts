import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import i18n from "../config/i18n";

/**
 * 根据当前 i18n 语言格式化日期
 * 中文：yyyy年MM月dd日 HH时mm分（如 2026年03月17日 14时18分）
 * 英文：dd MMM yyyy, HH:mm（如 17 Mar 2026, 14:18）
 */
export function formatDateWithLocale(
  date: string | number | Date,
  formatStr?: string,
): string {
  const isZh = i18n.language?.startsWith("zh");
  const locale = isZh ? zhCN : undefined;
  const pattern = formatStr ?? (isZh ? "yyyy年MM月dd日 HH时mm分" : "dd MMM yyyy, HH:mm");
  return format(new Date(date), pattern, { locale });
}
