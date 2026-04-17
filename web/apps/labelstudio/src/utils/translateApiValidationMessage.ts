import type { TFunction } from "i18next";

const ANNOTATIONS_INCOMPATIBLE_PREFIX =
  "Created annotations are incompatible with provided labeling schema, we found:\n";

const ANNOTATION_MISMATCH_LINE =
  /^(\d+) with from_name=([^,]+), to_name=([^,]+), type=(.+)$/;

/**
 * Maps known English API validation strings to the current locale via i18n.
 * Unknown strings are returned unchanged.
 */
export function translateApiValidationMessage(message: unknown, t: TFunction): string {
  if (message == null) return "";
  const s = typeof message === "string" ? message : String(message);
  if (s.startsWith(ANNOTATIONS_INCOMPATIBLE_PREFIX)) {
    const rest = s.slice(ANNOTATIONS_INCOMPATIBLE_PREFIX.length);
    const lines = rest.split("\n").filter(Boolean);
    const outLines = lines.map((line) => {
      const m = line.match(ANNOTATION_MISMATCH_LINE);
      if (m) {
        return t("labelingConfig.validationMessages.annotationSchemaMismatchLine", {
          count: m[1],
          fromName: m[2],
          toName: m[3],
          type: m[4],
        });
      }
      return line;
    });
    return `${t("labelingConfig.validationMessages.annotationsIncompatibleIntro")}\n${outLines.join("\n")}`;
  }
  return s;
}
