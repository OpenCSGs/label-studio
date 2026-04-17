import { observer } from "mobx-react";
import { Result } from "antd";
import { Button } from "@humansignal/ui";
import { cn } from "../../utils/bem";
import { useEditorT } from "../../utils/i18n";

export const NothingToLabelView = observer(({ store }) => {
  const t = useEditorT();
  return (
    <div
      className={cn("editor").toClassName()}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        paddingBottom: "30vh",
      }}
    >
      <Result status="success" title={t("editor.emptyQueueTitle")} />
      <div className={cn("sub__result").toClassName()}>{t("editor.emptyQueueDescription")}</div>
      {store.taskHistory.length > 0 && (
        <Button
          onClick={(e) => store.prevTask(e, true)}
          variant="neutral"
          className="mx-0 my-4"
          aria-label={t("editor.ariaPreviousTask")}
        >
          {t("editor.goToPreviousTask")}
        </Button>
      )}
    </div>
  );
});

export const EditorMessageResult = observer(({ status = "success", messageKey }) => {
  const t = useEditorT();
  return (
    <div className={cn("editor").toClassName()}>
      <Result status={status} title={t(messageKey)} />
    </div>
  );
});
