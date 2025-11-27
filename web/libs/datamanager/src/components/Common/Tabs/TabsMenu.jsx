import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Menu } from "../Menu/Menu";

export const TabsMenu = ({ onClick, editable = true, closable = true, clonable = true, virtual = false }) => {
  const { t } = useTranslation();
  const items = useMemo(
    () => [
      {
        key: "edit",
        title: t("dataManager.rename"),
        enabled: editable && !virtual,
        action: () => onClick("edit"),
      },
      {
        key: "duplicate",
        title: t("dataManager.duplicate"),
        enabled: !virtual && clonable,
        action: () => onClick("duplicate"),
        willLeave: true,
      },
      {
        key: "save",
        title: t("dataManager.save"),
        enabled: virtual,
        action: () => onClick("save"),
        willLeave: true,
      },
    ],
    [editable, closable, clonable, virtual, t],
  );

  const showDivider = useMemo(() => closable && items.some(({ enabled }) => enabled), [items]);

  return (
    <Menu size="medium" onClick={(e) => e.domEvent.stopPropagation()}>
      {items.map((item) =>
        item.enabled ? (
          <Menu.Item key={item.key} onClick={item.action} data-leave={item.willLeave}>
            {item.title}
          </Menu.Item>
        ) : null,
      )}

      {closable ? (
        <>
          {showDivider && <Menu.Divider />}
          <Menu.Item onClick={() => onClick("close")} data-leave>
            {t("dataManager.close")}
          </Menu.Item>
        </>
      ) : null}
    </Menu>
  );
};
