import { cn } from "../../utils/bem";
import { Menu } from "../Menu/Menu";
import "./SidebarMenu.scss";
import { useTranslation } from "react-i18next";

const translateMenuItem = (menuItem, t) => {
  const menuItemMap = {
    "General": t("settings.general"),
    "Labeling Interface": t("settings.labelingInterface"),
    "Annotation": t("settings.annotationSettings"),
    "Cloud Storage": t("settings.cloudStorage"),
    "Predictions": t("settings.predictions"),
    "Webhooks": t("settings.webhooks"),
    "Danger Zone": t("settings.dangerZone"),
    "People": t("organization.people"),
  };
  return menuItemMap[menuItem] || menuItem;
};

export const SidebarMenu = ({ children, menu, path, menuItems }) => {
  const { t } = useTranslation();
  const rootClass = cn("sidebar-menu");

  // Translate menu items
  const translatedMenuItems = menuItems?.map(item => {
    if (typeof item === 'string' || Array.isArray(item)) {
      return item;
    }
    return {
      ...item,
      menuItem: item.menuItem ? translateMenuItem(item.menuItem, t) : item.menuItem,
      title: item.title ? translateMenuItem(item.title, t) : item.title,
    };
  });

  return (
    <div className={rootClass}>
      {menuItems && menuItems.length > 1 ? (
        <div className={rootClass.elem("navigation")}>
          <Menu>{translatedMenuItems ? Menu.Builder(path, translatedMenuItems) : menu}</Menu>
        </div>
      ) : null}
      <div className={rootClass.elem("content")}>{children}</div>
    </div>
  );
};
