import { inject, observer } from "mobx-react";
import { useCallback, useRef, useEffect, useState, useMemo } from "react";
import { IconChevronRight, IconChevronDown, IconTrash } from "@humansignal/icons";
import { Block, Elem } from "../../../utils/bem";
import { FF_LOPS_E_3, isFF } from "../../../utils/feature-flags";
import { Button, Spinner, Tooltip } from "@humansignal/ui";
import { Dropdown } from "../../Common/Dropdown/DropdownComponent";
import Form from "../../Common/Form/Form";
import { Menu } from "../../Common/Menu/Menu";
import { Modal } from "../../Common/Modal/ModalPopup";
import "./ActionsButton.scss";

const isFFLOPSE3 = isFF(FF_LOPS_E_3);
const injector = inject(({ store }) => ({
  store,
  hasSelected: store.currentView?.selected?.hasSelected ?? false,
}));

const DialogContent = ({ text, form, formRef, store, action }) => {
  const [formData, setFormData] = useState(form);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!formData) {
      setIsLoading(true);
      store
        .fetchActionForm(action.id)
        .then((form) => {
          setFormData(form);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [formData]);

  const fields = formData && formData.toJSON ? formData.toJSON() : formData;

  return (
    <Block name="dialog-content">
      <Elem name="text">{text}</Elem>
      {isLoading && (
        <Elem name="loading" style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
          <Spinner />
        </Elem>
      )}
      {formData && (
        <Elem name="form" style={{ paddingTop: 16 }}>
          <Form.Builder ref={formRef} fields={fields} autosubmit={false} withActions={false} />
        </Elem>
      )}
    </Block>
  );
};

const ActionButton = ({ action, parentRef, store, formRef }) => {
  const isDeleteAction = action.id.includes("delete");
  const hasChildren = !!action.children?.length;
  const submenuRef = useRef();

  const onClick = useCallback(
    (e) => {
      e.preventDefault();
      if (action.disabled) return;
      action?.callback
        ? action?.callback(store.currentView?.selected?.snapshot, action)
        : invokeAction(action, isDeleteAction, store, formRef);
      parentRef?.current?.close?.();
    },
    [store.currentView?.selected, action, isDeleteAction, parentRef, store, formRef],
  );

  const titleContainer = (
    <Block
      key={action.id}
      tag={Menu.Item}
      size="small"
      onClick={onClick}
      mod={{
        hasSeperator: isDeleteAction,
        hasSubMenu: action.children?.length > 0,
        isSeparator: action.isSeparator,
        isTitle: action.isTitle,
        danger: isDeleteAction,
        disabled: action.disabled,
      }}
      name="actionButton"
      aria-label={action.title}
    >
      <Elem name="titleContainer" {...(action.disabled ? { title: action.disabledReason } : {})}>
        <Elem name="title">{action.title}</Elem>
        {hasChildren ? <Elem name="icon" tag={IconChevronRight} /> : null}
      </Elem>
    </Block>
  );

  if (hasChildren) {
    return (
      <Dropdown.Trigger
        key={action.id}
        align="top-right-outside"
        toggle={false}
        ref={submenuRef}
        content={
          <Block name="actionButton-submenu" tag="ul">
            {action.children.map((childAction) => (
              <ActionButton
                key={childAction.id}
                action={childAction}
                parentRef={parentRef}
                store={store}
                formRef={formRef}
              />
            ))}
          </Block>
        }
      >
        {titleContainer}
      </Dropdown.Trigger>
    );
  }

  return (
    <Tooltip key={action.id} title={action.disabled_reason} disabled={!action.disabled} alignment="bottom-center">
      <div>
        <Menu.Item
          size="small"
          key={action.id}
          danger={isDeleteAction}
          onClick={onClick}
          className={`actionButton${action.isSeparator ? "_isSeparator" : action.isTitle ? "_isTitle" : ""} ${
            action.disabled ? "actionButton_disabled" : ""
          }`}
          icon={isDeleteAction && <IconTrash />}
          title={action.disabled ? action.disabledReason : null}
          aria-label={action.title}
        >
          {action.title}
        </Menu.Item>
      </div>
    </Tooltip>
  );
};

const invokeAction = (action, destructive, store, formRef) => {
  if (action.dialog) {
    const { type: dialogType, text, form, title } = action.dialog;
    const dialog = Modal[dialogType] ?? Modal.confirm;

    dialog({
      title: title ? title : destructive ? "Destructive action" : "Confirm action",
      body: <DialogContent text={text} form={form} formRef={formRef} store={store} action={action} />,
      buttonLook: destructive ? "destructive" : "primary",
      onOk() {
        const body = formRef.current?.assembleFormData({ asJSON: true });

        store.SDK.invoke("actionDialogOk", action.id, { body });
        store.invokeAction(action.id, { body });
      },
      closeOnClickOutside: false,
    });
  } else {
    store.invokeAction(action.id);
  }
};

export const ActionsButton = injector(
  observer(({ store, size, hasSelected, ...rest }) => {
    const formRef = useRef();
    const selectedCount = store.currentView.selectedCount;
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const actions = useMemo(() => {
      return store.availableActions.filter((a) => !a.hidden).sort((a, b) => a.order - b.order);
    }, [store.availableActions]);

    useEffect(() => {
      if (isOpen && actions.length === 0) {
        setIsLoading(true);
        store.fetchActions().finally(() => {
          setIsLoading(false);
        });
      }
    }, [isOpen, actions]);

    const actionButtons = actions.map((action) => (
      <ActionButton key={action.id} action={action} parentRef={formRef} store={store} formRef={formRef} />
    ));
    const recordTypeLabel = isFFLOPSE3 && store.SDK.type === "DE" ? "Record" : "Task";

    return (
      <Dropdown.Trigger
        content={
          <Menu size="compact">{isLoading ? <Menu.Item disabled>Loading actions...</Menu.Item> : actionButtons}</Menu>
        }
        openUpwardForShortViewport={false}
        disabled={!hasSelected}
        onToggle={setIsOpen}
      >
        <Button
          size={size}
          variant="neutral"
          look="outlined"
          disabled={!hasSelected}
          trailing={<IconChevronDown />}
          aria-label="Tasks Actions"
          {...rest}
        >
          {selectedCount > 0 ? `${selectedCount} ${recordTypeLabel}${selectedCount > 1 ? "s" : ""}` : "Actions"}
        </Button>
      </Dropdown.Trigger>
    );
  }),
);
