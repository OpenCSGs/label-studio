import type { TFunction } from "i18next";
import type { Tip } from "./types";

/**
 * Resolves Heidi tip copy from i18n using `link.params.treatment` as the stable id.
 * English (and other locales without `heidiTips.*` keys) falls back to runtime `tip` strings from API/local JSON.
 */
export function translateHeidiTip(
  t: TFunction,
  collection: string,
  tip: Tip,
): { title: string; body: string; linkLabel: string } {
  const treatment = tip.link?.params?.treatment;
  const fallbackTitle = tip.title;
  const fallbackBody = tip.content ?? tip.description ?? "";
  const fallbackLink = tip.link.label;

  if (!treatment) {
    return { title: fallbackTitle, body: fallbackBody, linkLabel: fallbackLink };
  }

  const base = `heidiTips.${collection}.${treatment}`;
  return {
    title: t(`${base}.title`, { defaultValue: fallbackTitle }),
    body: t(`${base}.content`, { defaultValue: fallbackBody }),
    linkLabel: t(`${base}.link`, { defaultValue: fallbackLink }),
  };
}
