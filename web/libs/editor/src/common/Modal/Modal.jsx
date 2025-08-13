import { createRef } from "react";
import { render } from "react-dom";
import { cn } from "../../utils/bem";
import { Button } from "@humansignal/ui";
import { Space } from "../Space/Space";
import { Modal } from "./ModalPopup";

const standaloneModal = (props) => {
  const modalRef = createRef();
  const rootDiv = document.createElement("div");

  rootDiv.className = cn("modal-holder").toClassName();

  document.body.appendChild(rootDiv);

  const renderModal = (props, animate) => {
    render(
      <Modal
        ref={modalRef}
        {...props}
        onHide={() => {
          props.onHidden?.();
          rootDiv.remove();
        }}
        animateAppearance={animate}
      />,
      rootDiv,
    );
  };

  renderModal(props, true);

  return {
    update(newProps) {
      renderModal({ ...props, ...(newProps ?? {}) }, false);
    },
    close() {
      modalRef.current.hide();
    },
  };
};

export const confirm = ({ okText, onOk, cancelText, onCancel, buttonLook, ...props }) => {
  const modal = standaloneModal({
    ...props,
    allowClose: false,
    footer: (
      <Space align="end">
        <Button
          onClick={() => {
            onCancel?.();
            modal.close();
          }}
          size="small"
          look="outlined"
          autoFocus
          aria-label="Cancel"
        >
          {cancelText ?? "Cancel"}
        </Button>

        <Button
          onClick={() => {
            onOk?.();
            modal.close();
          }}
          size="small"
          look={buttonLook ?? "primary"}
          aria-label="Confirm"
        >
          {okText ?? "OK"}
        </Button>
      </Space>
    ),
  });

  return modal;
};

export const info = ({ okText, onOkPress, ...props }) => {
  const modal = standaloneModal({
    ...props,
    footer: (
      <Space align="end">
        <Button
          onClick={() => {
            onOkPress?.();
            modal.close();
          }}
          size="small"
          aria-label={okText ?? "OK"}
        >
          {okText ?? "OK"}
        </Button>
      </Space>
    ),
  });

  return modal;
};

export { standaloneModal as modal };
export { Modal };

Object.assign(Modal, {
  info,
  confirm,
  modal: standaloneModal,
});
