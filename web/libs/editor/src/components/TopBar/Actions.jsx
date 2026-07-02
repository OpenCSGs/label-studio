import { Button } from "@humansignal/ui";
import { IconCopy, IconInfo, IconViewAll, IconTrash, IconSettings } from "@humansignal/icons";
import { Tooltip } from "@humansignal/ui";
import { cn } from "../../utils/bem";
import { isSelfServe } from "../../utils/billing";
import { FF_BULK_ANNOTATION, isFF } from "../../utils/feature-flags";
import { GroundTruth } from "../CurrentEntity/GroundTruth";
import { EditingHistory } from "./HistoryActions";
import { confirm } from "../../common/Modal/Modal";
import { useCallback } from "react";
import { useEditorT } from "../../utils/i18n";

export const Actions = ({ store }) => {
  const t = useEditorT();
  const annotationStore = store.annotationStore;
  const entity = annotationStore.selected;
  const saved = !entity.userGenerate || entity.sentUserGenerate;
  const isPrediction = entity?.type === "prediction";
  const isViewAll = annotationStore.viewingAll;
  const isBulkMode = isFF(FF_BULK_ANNOTATION) && !isSelfServe() && store.hasInterface("annotation:bulk");

  const onToggleVisibility = useCallback(() => {
    annotationStore.toggleViewingAllAnnotations();
  }, [annotationStore]);

  return (
    <div className={cn("topbar").elem("section").toClassName()}>
      {store.hasInterface("annotations:view-all") && !isBulkMode && (
        <Tooltip title={t("annotation.compareAllAnnotations")}>
          <Button
            icon={<IconViewAll />}
            aria-label={t("annotation.compareAllAnnotations")}
            onClick={() => onToggleVisibility()}
            variant={isViewAll ? "primary" : "neutral"}
            look={isViewAll ? "filled" : "string"}
            style={{
              height: 36,
              width: 36,
              padding: 0,
            }}
          />
        </Tooltip>
      )}

      {!isViewAll && !isBulkMode && store.hasInterface("ground-truth") && <GroundTruth entity={entity} />}

      {!isPrediction && !isViewAll && store.hasInterface("edit-history") && <EditingHistory entity={entity} />}

      {!isViewAll && !isBulkMode && store.hasInterface("annotations:delete") && (
        <Tooltip title={t("annotation.deleteAnnotation")}>
          <Button
            icon={<IconTrash />}
            variant="negative"
            look="string"
            type="text"
            aria-label={t("annotation.delete")}
            onClick={() => {
              confirm({
                title: t("annotation.deleteAnnotation"),
                body: t("annotation.actionCannotBeUndone"),
                buttonLook: "destructive",
                okText: t("annotation.proceed"),
                onOk: () => entity.list.deleteAnnotation(entity),
              });
            }}
            style={{
              height: 36,
              width: 36,
              padding: 0,
            }}
          />
        </Tooltip>
      )}

      {!isViewAll && !isBulkMode && store.hasInterface("annotations:add-new") && saved && (
        <Tooltip title={t("annotation.createCopyOfCurrent", { type: entity.type })}>
          <Button
            icon={<IconCopy style={{ width: 36, height: 36 }} />}
            variant="neutral"
            look="string"
            type="text"
            aria-label={t("annotation.copyAnnotation")}
            onClick={(ev) => {
              ev.preventDefault();

              const cs = store.annotationStore;
              const c = cs.addAnnotationFromPrediction(entity);

              // this is here because otherwise React doesn't re-render the change in the tree
              window.setTimeout(() => {
                store.annotationStore.selectAnnotation(c.id);
              }, 50);
            }}
            style={{
              height: 36,
              width: 36,
              padding: 0,
            }}
          />
        </Tooltip>
      )}

      <Button
        icon={<IconSettings />}
        variant="neutral"
        look="string"
        aria-label={t("editor.toolbarSettings")}
        tooltip={t("editor.toolbarSettings")}
        onClick={() => store.toggleSettings()}
        style={{
          height: 36,
          width: 36,
          padding: 0,
        }}
      />

      {store.description && store.hasInterface("instruction") && !isBulkMode && (
        <Button
          icon={<IconInfo style={{ width: 16, height: 16 }} />}
          variant={store.showingDescription ? "primary" : "neutral"}
          look={store.showingDescription ? "filled" : "string"}
          aria-label={t("annotation.instructions")}
          onClick={() => store.toggleDescription()}
          style={{
            height: 36,
            width: 36,
            padding: 0,
          }}
        />
      )}
    </div>
  );
};
