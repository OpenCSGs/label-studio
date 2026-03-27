import { Button } from "@humansignal/ui";
import i18n from "../../config/i18n";
import { modal } from "../../components/Modal/Modal";
import { useModalControls } from "../../components/Modal/ModalPopup";
import { Space } from "../../components/Space/Space";
import { cn } from "../../utils/bem";

export const WebhookDeleteModal = ({ onDelete }) => {
  const t = (key) => i18n.t(key);
  return modal({
    title: t("webhooks.deleteConfirmTitle"),
    body: () => {
      const ctrl = useModalControls();
      const rootClass = cn("webhook-delete-modal");
      return (
        <div className={rootClass}>
          <div className={rootClass.elem("modal-text")}>
            {t("webhooks.deleteConfirmBody")}
          </div>
        </div>
      );
    },
    footer: () => {
      const ctrl = useModalControls();
      const rootClass = cn("webhook-delete-modal");
      return (
        <Space align="end">
          <Button
            look="outlined"
            onClick={() => {
              ctrl.hide();
            }}
            aria-label={t("webhooks.cancelDeletion")}
          >
            {t("webhooks.cancel")}
          </Button>
          <Button
            variant="negative"
            onClick={async () => {
              await onDelete();
              ctrl.hide();
            }}
            aria-label={t("webhooks.confirmDeletion")}
          >
            {t("webhooks.deleteWebhook")}
          </Button>
        </Space>
      );
    },
    style: { width: 512 },
  });
};
