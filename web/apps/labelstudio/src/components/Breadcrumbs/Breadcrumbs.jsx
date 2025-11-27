import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useConfig } from "../../providers/ConfigProvider";
import { useBreadcrumbs, useFindRouteComponent } from "../../providers/RoutesProvider";
import { BemWithSpecifiContext } from "../../utils/bem";
import { absoluteURL } from "../../utils/helpers";
import { Dropdown } from "../Dropdown/Dropdown";
import { Menu } from "../Menu/Menu";
import "./Breadcrumbs.scss";
import { useTranslation } from "react-i18next";

const { Block, Elem } = BemWithSpecifiContext();

const translateTitle = (title, t) => {
  const titleMap = {
    "Home": t("menu.home"),
    "Projects": t("menu.projects"),
    "Organization": t("menu.organization"),
    "People": t("organization.people"),
    "Settings": t("settings.title"),
    "General": t("settings.general"),
    "Labeling Interface": t("settings.labelingInterface"),
    "Annotation": t("settings.annotationSettings"),
    "Cloud Storage": t("settings.cloudStorage"),
    "Predictions": t("settings.predictions"),
    "Webhooks": t("settings.webhooks"),
    "Danger Zone": t("settings.dangerZone"),
    "Data Manager": t("annotation.dataManager"),
    "Labeling": t("annotation.labeling"),
  };
  return titleMap[title] || title;
};

export const Breadcrumbs = () => {
  const { t } = useTranslation();
  const config = useConfig();
  const reactBreadcrumbs = useBreadcrumbs();
  const findComponent = useFindRouteComponent();
  const [breadcrumbs, setBreadcrumbs] = useState(reactBreadcrumbs);

  useEffect(() => {
    if (reactBreadcrumbs.length) {
      setBreadcrumbs(reactBreadcrumbs.map(item => ({
        ...item,
        title: translateTitle(item.title, t),
        submenu: item.submenu?.map(sub => ({
          ...sub,
          title: translateTitle(sub.title, t),
        })),
      })));
    } else if (config.breadcrumbs) {
      setBreadcrumbs(config.breadcrumbs.map(item => ({
        ...item,
        title: translateTitle(item.title, t),
        submenu: item.submenu?.map(sub => ({
          ...sub,
          title: translateTitle(sub.title, t),
        })),
      })));
    }
  }, [reactBreadcrumbs, config, t]);

  return (
    <Block name="breadcrumbs">
      <Elem tag="ul" name="list">
        {breadcrumbs.map((item, index, list) => {
          const isLastItem = index === list.length - 1;

          const key = `item-${index}-${item.title}`;

          const href = item.href ?? item.path;

          const isInternal = findComponent(href) !== null;

          const title = (
            <Elem tag="span" name="label" mod={{ faded: index === item.length - 1 }}>
              {item.title}
            </Elem>
          );

          const dropdownSubmenu = item.submenu ? (
            <Dropdown>
              <Menu>
                {item.submenu.map((sub, index) => {
                  return (
                    <Menu.Item
                      key={`${index}-${item.title}`}
                      label={sub.title}
                      icon={sub.icon}
                      href={sub.href ?? sub.path}
                      active={sub.active}
                    />
                  );
                })}
              </Menu>
            </Dropdown>
          ) : null;

          return item.onClick ? (
            <Elem key={key} tag="li" name="item" mod={{ last: isLastItem }}>
              <span onClick={item.onClick}>{title}</span>
            </Elem>
          ) : dropdownSubmenu ? (
            <Elem
              key={key}
              tag="li"
              component={Dropdown.Trigger}
              name="item"
              mod={{ last: isLastItem }}
              content={dropdownSubmenu}
            >
              <span>{title}</span>
            </Elem>
          ) : href && !isLastItem ? (
            <Elem key={key} tag="li" name="item" mod={{ last: isLastItem }}>
              {isInternal ? (
                <NavLink to={href} data-external={true}>
                  {title}
                </NavLink>
              ) : (
                <a href={absoluteURL(href)}>{title}</a>
              )}
            </Elem>
          ) : (
            <Elem key={key} tag="li" name="item" mod={{ last: isLastItem }}>
              {title}
            </Elem>
          );
        })}
      </Elem>
    </Block>
  );
};
