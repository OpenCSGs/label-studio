/**
 * Column id/alias to i18n key mapping for Data Manager columns.
 * Keys must match web/apps/labelstudio/src/locales/en.json and zh.json under dataManager.
 */
const COLUMN_TITLE_KEYS = {
  id: "columnId",
  inner_id: "columnInnerId",
  data: "columnData",
  completed_at: "columnCompleted",
  total_annotations: "columnAnnotations",
  cancelled_annotations: "columnCancelled",
  total_predictions: "columnPredictions",
  annotators: "columnAnnotatedBy",
  annotations_results: "columnAnnotationResults",
  annotations_ids: "columnAnnotationIds",
  predictions_score: "columnPredictionScore",
  predictions_model_versions: "columnPredictionModelVersions",
  predictions_results: "columnPredictionResults",
  file_upload: "columnUploadFilename",
  storage_filename: "columnStorageFilename",
  created_at: "columnCreatedAt",
  updated_at: "columnUpdatedAt",
  updated_by: "columnUpdatedBy",
  avg_lead_time: "columnLeadTime",
  draft_exists: "columnDrafts",
  image: "columnImage",
  img: "columnImg",
};

const COLUMN_HELP_KEYS = {
  id: "columnIdHelp",
  inner_id: "columnInnerIdHelp",
  completed_at: "columnCompletedHelp",
  total_annotations: "columnAnnotationsHelp",
  cancelled_annotations: "columnCancelledHelp",
  total_predictions: "columnPredictionsHelp",
  annotators: "columnAnnotatedByHelp",
  annotations_results: "columnAnnotationResultsHelp",
  annotations_ids: "columnAnnotationIdsHelp",
  predictions_score: "columnPredictionScoreHelp",
  predictions_model_versions: "columnPredictionModelVersionsHelp",
  predictions_results: "columnPredictionResultsHelp",
  file_upload: "columnUploadFilenameHelp",
  storage_filename: "columnStorageFilenameHelp",
  created_at: "columnCreatedAtHelp",
  updated_at: "columnUpdatedAtHelp",
  updated_by: "columnUpdatedByHelp",
  avg_lead_time: "columnLeadTimeHelp",
  draft_exists: "columnDraftsHelp",
};

/** Extract alias from column id (e.g. "tasks:id" -> "id") */
export const getColumnAlias = (column) => {
  const alias = column?.alias ?? column?.original?.alias;
  if (alias) return alias;
  const id = column?.id ?? column?.original?.id;
  if (!id || typeof id !== "string") return null;
  const parts = id.split(":");
  return parts.length > 1 ? parts[1] : id;
};

/**
 * Get translated column title. Uses i18n for known columns, raw title for project-defined.
 */
export const getColumnTitle = (column, rawTitle, t) => {
  const alias = getColumnAlias(column);
  const key = alias && COLUMN_TITLE_KEYS[alias];
  if (key && t) {
    const translated = t(`dataManager.${key}`);
    if (translated && translated !== `dataManager.${key}`) return translated;
  }
  return rawTitle ?? "";
};

/**
 * Get translated column help. Uses i18n for known columns, raw help for project-defined.
 */
export const getColumnHelp = (column, rawHelp, t) => {
  const alias = getColumnAlias(column);
  const key = alias && COLUMN_HELP_KEYS[alias];
  if (key && t) {
    const translated = t(`dataManager.${key}`);
    if (translated && translated !== `dataManager.${key}`) return translated;
  }
  return rawHelp ?? "";
};
