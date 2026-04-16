import { observer } from "mobx-react";
import { IconRedo, IconRemove, IconUndo } from "@humansignal/icons";
import { Tooltip, Button, Space } from "@humansignal/ui";
import { useEditorT } from "../../utils/i18n";
import "./HistoryActions.scss";

export const EditingHistory = observer(({ entity }) => {
  const { history } = entity;
  const t = useEditorT();

  return (
    <Space size="small">
      <Tooltip title={t("editor.toolbarUndo")}>
        <Button
          variant="neutral"
          size="small"
          aria-label={t("editor.toolbarUndo")}
          look="string"
          disabled={!history?.canUndo}
          onClick={() => entity.undo()}
          className="!p-0"
        >
          <IconUndo />
        </Button>
      </Tooltip>
      <Tooltip title={t("editor.toolbarRedo")}>
        <Button
          variant="neutral"
          size="small"
          look="string"
          aria-label={t("editor.toolbarRedo")}
          disabled={!history?.canRedo}
          onClick={() => entity.redo()}
          className="!p-0"
        >
          <IconRedo />
        </Button>
      </Tooltip>
      <Tooltip title={t("editor.toolbarReset")}>
        <Button
          variant="negative"
          look="string"
          size="small"
          aria-label={t("editor.toolbarReset")}
          disabled={!history?.canUndo}
          onClick={() => history?.reset()}
          className="!p-0"
        >
          <IconRemove />
        </Button>
      </Tooltip>
    </Space>
  );
});
