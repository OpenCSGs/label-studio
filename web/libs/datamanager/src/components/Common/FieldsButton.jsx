import { Button, Checkbox } from "@humansignal/ui";
import { inject, observer } from "mobx-react";
import React from "react";
import { cn } from "../../utils/bem";
import { Dropdown } from "@humansignal/ui";
import { Menu } from "./Menu/Menu";
import { getColumnTitle } from "../../utils/column-i18n";

const injector = inject(({ store }) => {
  return {
    columns: Array.from(store.currentView?.targetColumns ?? []),
    t: store?.t ?? ((k) => k),
  };
});

const FieldsMenu = observer(({ columns, WrapperComponent, onClick, onReset, selected, resetTitle, t }) => {
  const _t = t ?? ((k) => k);
  const MenuItem = (col, onClick) => {
    const displayTitle = getColumnTitle(col, col.title, _t);
    return (
      <Menu.Item key={col.key} name={col.key} onClick={onClick} disabled={col.disabled}>
        {WrapperComponent && col.wra !== false ? (
          <WrapperComponent column={col} disabled={col.disabled}>
            {displayTitle}
          </WrapperComponent>
        ) : (
          displayTitle
        )}
      </Menu.Item>
    );
  };

  return (
    <Menu size="small" selectedKeys={selected ? [selected] : ["none"]} closeDropdownOnItemClick={false}>
      {onReset &&
        MenuItem(
          {
            key: "none",
            title: resetTitle ?? _t("dataManager.default"),
            wrap: false,
          },
          onReset,
        )}

      {columns.map((col) => {
        if (col.children) {
          return (
            <Menu.Group key={col.key} title={getColumnTitle(col, col.title, _t)}>
              {col.children.map((col) => MenuItem(col, () => onClick?.(col)))}
            </Menu.Group>
          );
        }
        if (!col.parent) {
          return MenuItem(col, () => onClick?.(col));
        }

        return null;
      })}
    </Menu>
  );
});

export const FieldsButton = injector(
  ({
    columns,
    size,
    style,
    wrapper,
    title,
    icon,
    className,
    trailingIcon,
    onClick,
    onReset,
    resetTitle,
    filter,
    selected,
    t,
    tooltip,
    tooltipTheme = "dark",
    openUpwardForShortViewport = true,
    "data-testid": dataTestId,
  }) => {
    const content = [];

    if (title) content.push(<React.Fragment key="f-button-title">{title}</React.Fragment>);

    const renderButton = () => {
      return (
        <Button
          variant="neutral"
          size="small"
          look="outlined"
          leading={icon}
          trailing={trailingIcon}
          data-testid={dataTestId}
        >
          {content.length ? content : null}
        </Button>
      );
    };

    return (
      <Dropdown.Trigger
        content={
          <FieldsMenu
            columns={filter ? columns.filter(filter) : columns}
            WrapperComponent={wrapper}
            onClick={onClick}
            size={size}
            onReset={onReset}
            selected={selected}
            resetTitle={resetTitle}
            t={t}
          />
        }
        style={{ maxHeight: 280, overflow: "auto" }}
        openUpwardForShortViewport={openUpwardForShortViewport}
      >
        {tooltip ? (
          <div className={`${cn("field-button").toClassName()} h-[40px] flex items-center`} style={{ zIndex: 1000 }}>
            <Button
              tooltip={tooltip}
              variant="neutral"
              size={size}
              look="outlined"
              leading={icon}
              trailing={trailingIcon}
              data-testid={dataTestId}
            >
              {content.length ? content : null}
            </Button>
          </div>
        ) : (
          renderButton()
        )}
      </Dropdown.Trigger>
    );
  },
);

FieldsButton.Checkbox = observer(({ column, children, disabled }) => {
  return (
    <Checkbox
      size="small"
      checked={!column.hidden}
      onChange={column.toggleVisibility}
      style={{ width: "100%", height: "100%" }}
      disabled={disabled}
    >
      {children}
    </Checkbox>
  );
});
