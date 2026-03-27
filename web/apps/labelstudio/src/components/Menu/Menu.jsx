import { forwardRef, useCallback, useMemo } from "react";
import { cn } from "../../utils/bem";
import { useDropdown } from "@humansignal/ui";
import "./Menu.scss";
import { MenuContext } from "./MenuContext";
import { MenuItem } from "./MenuItem";

export const Menu = forwardRef(
  ({ children, className, style, size, selectedKeys, closeDropdownOnItemClick, contextual }, ref) => {
    const dropdown = useDropdown();

    const selected = useMemo(() => {
      return new Set(selectedKeys ?? []);
    }, [selectedKeys]);

    const clickHandler = useCallback(
      (e) => {
        const elem = cn("main-menu").elem("item").closest(e.target);

        if (dropdown && elem && closeDropdownOnItemClick !== false) {
          dropdown.close();
        }
      },
      [dropdown],
    );

    const collapsed = useMemo(() => {
      return !!dropdown;
    }, [dropdown]);

    return (
      <MenuContext.Provider value={{ selected }}>
        <ul
          ref={ref}
          className={cn("main-menu").mod({ size, collapsed, contextual }).mix(className).toClassName()}
          style={style}
          onClick={clickHandler}
        >
          {children}
        </ul>
      </MenuContext.Provider>
    );
  },
);

Menu.Item = MenuItem;
Menu.Spacer = () => <li className={cn("main-menu").elem("spacer").toClassName()} />;
Menu.Divider = () => <li className={cn("main-menu").elem("divider").toClassName()} />;
Menu.Builder = (url, menuItems, t) => {
  return (menuItems ?? []).map((item, index) => {
    if (item === "SPACER") return <Menu.Spacer key={index} />;
    if (item === "DIVIDER") return <Menu.Divider key={index} />;

    let pageLabel;
    let pagePath;

    if (Array.isArray(item)) {
      [pagePath, pageLabel] = item;
      if (t && typeof pageLabel === "string" && pageLabel.startsWith("i18n:")) {
        pageLabel = t(pageLabel.slice(4));
      }
    } else {
      const { menuItem, title, path, titleKey, menuItemKey } = item;
      const rawLabel = title ?? menuItem;
      pageLabel = t && (titleKey ?? menuItemKey) ? t(titleKey ?? menuItemKey) : rawLabel;
      pagePath = path;
    }

    if (typeof pagePath === "function") {
      return (
        <Menu.Item key={index} onClick={pagePath}>
          {pageLabel}
        </Menu.Item>
      );
    }

    const location = `${url}${pagePath}`.replace(/([/]+)/g, "/");

    return (
      <Menu.Item key={index} to={location} exact>
        {pageLabel}
      </Menu.Item>
    );
  });
};

Menu.Group = ({ children, title, className, style }) => {
  return (
    <div className={cn("menu-group").mix(className).toClassName()} style={style}>
      <div className={cn("menu-group").elem("title").toClassName()}>{title}</div>
      <ul className={cn("menu-group").elem("list").toClassName()}>{children}</ul>
    </div>
  );
};
