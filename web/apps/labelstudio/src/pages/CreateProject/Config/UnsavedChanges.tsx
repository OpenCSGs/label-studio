import { useCallback, useRef, useState } from "react";
import i18n from "../../../config/i18n";
import { Button } from "@humansignal/ui";
import { LeaveBlocker, type LeaveBlockerCallbacks } from "../../../components/LeaveBlocker/LeaveBlocker";
import { modal } from "../../../components/Modal/Modal";
import { Space } from "../../../components/Space/Space";

type SaveAndLeaveButtonProps = {
  onSave: () => Promise<void>;
  text?: string;
};
const SaveAndLeaveButton = ({ onSave, text }: SaveAndLeaveButtonProps) => {
  const [saving, setSaving] = useState(false);
  const saveHandler = useCallback(async () => {
    setSaving(true);
    await onSave();
    setSaving(false);
  }, [onSave]);
  const t = (key: string) => i18n.t(key);
  return (
    <Button size="small" onClick={saveHandler} waiting={saving} aria-label={t("unsavedChanges.saveChanges")}>
      {text ?? t("unsavedChanges.saveAndLeave")}
    </Button>
  );
};

type UnsavedChangesModalProps = {
  onSave: () => void;
  onCancel?: () => void;
  onDiscard?: () => void;
  cancelText?: string;
  discardText?: string;
  okText?: string;
  title?: string;
  body?: string;
};

export const unsavedChangesModal = ({
  onSave,
  onCancel,
  onDiscard,
  cancelText,
  discardText,
  okText,
  title,
  body,
  ...props
}: UnsavedChangesModalProps) => {
  const t = (key: string) => i18n.t(key);
  const modalTitle = title ?? t("unsavedChanges.title");
  const modalBody = body ?? t("unsavedChanges.body");
  let modalInstance: any = undefined;
  const saveAndLeave = async () => {
    await onSave?.();
    modalInstance?.close();
  };
  modalInstance = modal({
    ...props,
    title: modalTitle,
    body: () => <>{modalBody}</>,
    allowClose: true,
    footer: (
      <Space align="end">
        <Button
          look="outlined"
          size="small"
          onClick={() => {
            onCancel?.();
            modalInstance?.close();
          }}
          autoFocus
        >
          {cancelText ?? t("unsavedChanges.cancel")}
        </Button>

        {onDiscard && (
          <Button
            variant="negative"
            look="outlined"
            onClick={() => {
              onDiscard?.();
              modalInstance?.close();
            }}
            size="small"
          >
            {discardText ?? t("unsavedChanges.discardAndLeave")}
          </Button>
        )}

        <SaveAndLeaveButton onSave={saveAndLeave} text={okText} />
      </Space>
    ),
    style: { width: 512 },
    unique: "UNSAVED_CHANGES_MODAL",
  });
};

type UnsavedChangesProps = {
  hasChanges: boolean;
  onSave: () => any;
};

/**
 * Component that blocks navigation if there are unsaved changes
 * @param hasChanges - flag that indicates if there are unsaved changes
 * @param onSave - function that should be called to save changes
 */
export const UnsavedChanges = ({ hasChanges, onSave }: UnsavedChangesProps) => {
  const saveHandlerRef = useRef(onSave);
  saveHandlerRef.current = onSave;
  const blockHandler = useCallback(async ({ continueCallback, cancelCallback }: LeaveBlockerCallbacks) => {
    const wrappedOnSave = async () => {
      const result = await saveHandlerRef.current?.();
      if (result === true) {
        continueCallback && setTimeout(continueCallback, 0);
      } else {
        // We consider that user tries to save changes, but as long as there are some errors,
        // we just close the modal to allow user to see and fix them
        cancelCallback?.();
      }
    };

    unsavedChangesModal({
      onSave: wrappedOnSave,
      onCancel: cancelCallback,
      onDiscard: continueCallback,
    });
  }, []);

  return <LeaveBlocker active={hasChanges} onBlock={blockHandler} />;
};
