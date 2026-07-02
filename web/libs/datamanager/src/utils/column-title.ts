/**
 * String-based column title i18n for Data Manager.
 *
 * The backend returns column titles as English strings (e.g. "Annotated by",
 * "Completed"). This maps a standard English title to its i18n key under
 * `dataManager.columnTitle.*` (see web/apps/labelstudio/src/locales/*.json).
 * Unknown / project-defined titles are returned unchanged.
 */

type TFunction = (key: string, options?: Record<string, unknown>) => string;

/** Standard English column title -> dataManager.columnTitle.* key */
export const STANDARD_COLUMN_TITLES: Record<string, string> = {
  ID: "id",
  "Inner ID": "innerId",
  Completed: "completed",
  Annotations: "annotations",
  Cancelled: "cancelled",
  Predictions: "predictions",
  "Annotated by": "annotatedBy",
  "Annotation results": "annotationResults",
  "Annotation IDs": "annotationIds",
  "Prediction score": "predictionScore",
  "Prediction model versions": "predictionModelVersions",
  "Prediction results": "predictionResults",
  "Upload filename": "uploadFilename",
  "Annotators IDs": "annotatorsIds",
  "Annotation drafts": "annotationDrafts",
  Annotated: "annotated",
  Agreement: "agreement",
  "Reviews accepted": "reviewsAccepted",
  "Reviews rejected": "reviewsRejected",
  "Ground truth": "groundTruth",
  Comments: "comments",
  "Unresolved comments": "unresolvedComments",
  "Created at": "createdAt",
  "Updated at": "updatedAt",
};

/**
 * Translate a standard English column title. Unknown titles are returned as-is.
 */
export const translateColumnTitle = (t: TFunction | undefined, title: unknown): unknown => {
  if (typeof title !== "string") return title;
  const key = STANDARD_COLUMN_TITLES[title];
  if (key && t) {
    return t(`dataManager.columnTitle.${key}`, { defaultValue: title });
  }
  return title;
};
