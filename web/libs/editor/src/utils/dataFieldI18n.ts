/**
 * Data field name → dataManager i18n key suffix (aligned with datamanager column-i18n COLUMN_TITLE_KEYS).
 */
const DATA_FIELD_NAME_KEYS: Record<string, string> = {
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

type TFn = (key: string) => string;

export function translateDataFieldName(field: string, t: TFn): string {
  const suffix = DATA_FIELD_NAME_KEYS[field];
  if (suffix) {
    const key = `dataManager.${suffix}`;
    const translated = t(key);
    if (translated && translated !== key) return translated;
  }
  return field;
}

/** Object tag types from config (lowercase). */
export function translateDataFieldType(type: string, t: TFn): string {
  const normalized = type?.toLowerCase?.() ?? type;
  const key = `annotation.dataSummaryFieldType.${normalized}`;
  const translated = t(key);
  if (translated && translated !== key) return translated;
  return type;
}
