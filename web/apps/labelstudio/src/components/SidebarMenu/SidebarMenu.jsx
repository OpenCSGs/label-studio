import { cn } from "../../utils/bem";
import { useTranslation } from "react-i18next";
import { Menu } from "../Menu/Menu";
import "./SidebarMenu.scss";

export const SidebarMenu = ({ children, menu, path, menuItems }) => {
  const { t } = useTranslation();
  const rootClass = cn("sidebar-menu");

  return (
    <div className={rootClass}>
      {menuItems && menuItems.length > 1 ? (
        <div className={rootClass.elem("navigation")}>
          <Menu>{menuItems ? Menu.Builder(path, menuItems, t) : menu}</Menu>
        </div>
      ) : null}
      <div className={rootClass.elem("content")}>{children}</div>
    </div>
  );
};
