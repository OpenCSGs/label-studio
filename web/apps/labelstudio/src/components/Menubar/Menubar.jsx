import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StaticContent } from "../../app/StaticContent/StaticContent";
import {
  IconFolder,
  IconHotkeys,
  IconPeople,
  IconPersonInCircle,
  IconPin,
  IconGlobe,
} from "@humansignal/icons";
import { LSLogo } from "../../assets/images";
import { Button, Userpic, ThemeToggle } from "@humansignal/ui";
import { useConfig } from "../../providers/ConfigProvider";
import { useContextComponent, useFixedLocation } from "../../providers/RoutesProvider";
import { useAuth } from "@humansignal/core/providers/AuthProvider";
import { useAPI } from "../../providers/ApiProvider";
import { cn } from "../../utils/bem";
import { isDefined } from "../../utils/helpers";
import { Breadcrumbs } from "../Breadcrumbs/Breadcrumbs";
import { Dropdown } from "@humansignal/ui";
import { Hamburger } from "../Hamburger/Hamburger";
import { Menu } from "../Menu/Menu";
import "./Menubar.scss";
import "./MenuContent.scss";
import "./MenuSidebar.scss";
import { pages } from "@humansignal/app-common";
import { ff } from "@humansignal/core";
import { openHotkeyHelp } from "@humansignal/app-common/pages/AccountSettings/sections/Hotkeys/Help";
import { useTranslation } from "react-i18next";

export const MenubarContext = createContext();

const LeftContextMenu = ({ className }) => (
  <StaticContent id="context-menu-left" className={className}>
    {(template) => <Breadcrumbs fromTemplate={template} />}
  </StaticContent>
);

const RightContextMenu = ({ className, ...props }) => {
  const { ContextComponent, contextProps } = useContextComponent();

  return ContextComponent ? (
    <div className={className}>
      <ContextComponent {...props} {...(contextProps ?? {})} />
    </div>
  ) : (
    <StaticContent id="context-menu-right" className={className} />
  );
};

export const Menubar = ({ enabled, defaultOpened, defaultPinned, children, onSidebarToggle, onSidebarPin }) => {
  const menuDropdownRef = useRef();
  const useMenuRef = useRef();
  const langMenuRef = useRef();
  const api = useAPI();
  const { user, isLoading } = useAuth();
  const location = useFixedLocation();
  const { i18n, t } = useTranslation();
  const [logoUrl, setLogoUrl] = useState(null);
  const [useDefaultLogo, setUseDefaultLogo] = useState(true);

  const handleLanguageChange = useCallback(
    (lang) => {
      i18n.changeLanguage(lang);
      langMenuRef.current?.close?.();
    },
    [i18n],
  );

  const config = useConfig();
  const [sidebarOpened, setSidebarOpened] = useState(defaultOpened ?? false);
  const [sidebarPinned, setSidebarPinned] = useState(defaultPinned ?? false);
  const [PageContext, setPageContext] = useState({
    Component: null,
    props: {},
  });

  const menubarClass = cn("menu-header");
  const menubarContext = menubarClass.elem("context");
  const sidebarClass = cn("sidebar");
  const contentClass = cn("content-wrapper");
  const contextItem = menubarClass.elem("context-item");
  const showNewsletterDot = !isDefined(user?.allow_newsletters);

  // 获取用户显示名称：优先 user_name，其次 username，最后 email（与 CSGHub 一致）
  const userDisplayName = useMemo(() => {
    if (!user) return "";
    if (user.user_name) return user.user_name;
    if (user.username) return user.username;
    return user.email || "";
  }, [user]);

  const sidebarPin = useCallback(
    (e) => {
      e.preventDefault();

      const newState = !sidebarPinned;

      setSidebarPinned(newState);
      onSidebarPin?.(newState);
    },
    [sidebarPinned],
  );

  const sidebarToggle = useCallback(
    (visible) => {
      const newState = visible;

      setSidebarOpened(newState);
      onSidebarToggle?.(newState);
    },
    [sidebarOpened],
  );

  const providerValue = useMemo(
    () => ({
      PageContext,

      setContext(ctx) {
        setTimeout(() => {
          setPageContext({
            ...PageContext,
            Component: ctx,
          });
        });
      },

      setProps(props) {
        setTimeout(() => {
          setPageContext({
            ...PageContext,
            props,
          });
        });
      },

      contextIsSet(ctx) {
        return PageContext.Component === ctx;
      },
    }),
    [PageContext],
  );

  useEffect(() => {
    if (!sidebarPinned) {
      menuDropdownRef?.current?.close();
    }
    useMenuRef?.current?.close();
  }, [location]);

  // 动态 logo（systemConfig）
  useEffect(() => {
    let isMounted = true;
    let img = null;
    const fetchLogo = async () => {
      try {
        const origin = localStorage.getItem("origin");
        const result = await api.callApi("systemConfig", { suppressError: true });
        if (!isMounted) return;
        if (result && !result.error) {
          const data = result.response || result;
          const logoPath = data?.system_configs?.general_configs?.logo;
          if (logoPath && logoPath.trim()) {
            let finalLogoUrl =
              logoPath.startsWith("http://") || logoPath.startsWith("https://")
                ? logoPath
                : origin
                  ? (logoPath.startsWith("/") ? `${origin}${logoPath}` : `${origin}/${logoPath}`)
                  : null;
            if (finalLogoUrl) {
              img = new Image();
              img.onload = () => {
                if (isMounted) {
                  setLogoUrl(finalLogoUrl);
                  setUseDefaultLogo(false);
                }
              };
              img.onerror = () => {
                if (isMounted) {
                  setUseDefaultLogo(true);
                  setLogoUrl(null);
                }
              };
              img.src = finalLogoUrl;
            }
          } else if (isMounted) {
            setUseDefaultLogo(true);
            setLogoUrl(null);
          }
        } else if (isMounted) {
          setUseDefaultLogo(true);
          setLogoUrl(null);
        }
      } catch {
        if (isMounted) {
          setUseDefaultLogo(true);
          setLogoUrl(null);
        }
      }
    };
    fetchLogo();
    return () => {
      isMounted = false;
      if (img) {
        img.onload = null;
        img.onerror = null;
        img.src = "";
      }
    };
  }, [api]);

  return (
    <div className={contentClass}>
      {enabled && (
        <div className={menubarClass}>
          <Dropdown.Trigger dropdown={menuDropdownRef} closeOnClickOutside={!sidebarPinned}>
            <div className={`${menubarClass.elem("trigger")} main-menu-trigger`}>
              {logoUrl && !useDefaultLogo ? (
                <img
                  src={logoUrl}
                  className={menubarClass.elem("logo")}
                  alt="Logo"
                  onError={() => {
                    setUseDefaultLogo(true);
                    setLogoUrl(null);
                  }}
                />
              ) : (
                <LSLogo className={menubarClass.elem("logo")} alt="Label Studio Logo" />
              )}
              <Hamburger opened={sidebarOpened} />
            </div>
          </Dropdown.Trigger>

          <div className={menubarContext}>
            <LeftContextMenu className={contextItem.mod({ left: true })} />
            <RightContextMenu className={contextItem.mod({ right: true })} />
          </div>

          <div className={menubarClass.elem("hotkeys")}>
            <div className={menubarClass.elem("hotkeys-button")}>
              <Button
                variant="neutral"
                look="outlined"
                tooltip={t("menu.keyboardShortcuts")}
                data-testid="hotkeys-button"
                size="small"
                onClick={() => {
                  openHotkeyHelp([
                    "annotation",
                    "data_manager",
                    "regions",
                    "tools",
                    "audio",
                    "video",
                    "timeseries",
                    "image_gallery",
                  ]);
                }}
                icon={<IconHotkeys />}
              />
            </div>
            <Dropdown.Trigger
              ref={langMenuRef}
              align="right"
              content={
                <Menu>
                  <Menu.Item
                    label={t("menu.english")}
                    onClick={() => handleLanguageChange("en")}
                    active={i18n.language === "en" || i18n.language.startsWith("en")}
                  />
                  <Menu.Item
                    label={t("menu.chinese")}
                    onClick={() => handleLanguageChange("zh")}
                    active={i18n.language === "zh" || i18n.language.startsWith("zh")}
                  />
                </Menu>
              }
            >
              <div className={menubarClass.elem("hotkeys-button")}>
                <Button
                  variant="neutral"
                  look="outlined"
                  tooltip={t("menu.switchLanguage")}
                  data-testid="language-button"
                  size="small"
                  icon={<IconGlobe />}
                />
              </div>
            </Dropdown.Trigger>
          </div>

          {ff.isActive(ff.FF_THEME_TOGGLE) && <ThemeToggle t={t} />}

          <Dropdown.Trigger
            ref={useMenuRef}
            align="right"
            content={
              <Menu>
                <Menu.Item
                  icon={<IconPersonInCircle />}
                  label={t("menu.accountSettings")}
                  href={pages.AccountSettingsPage.path}
                />
                {showNewsletterDot && (
                  <>
                    <Menu.Divider />
                    <Menu.Item className={cn("newsletter-menu-item")} href={pages.AccountSettingsPage.path}>
                      <span>{t("menu.checkNotificationSettings")}</span>
                      <span className={cn("newsletter-menu-badge")} />
                    </Menu.Item>
                  </>
                )}
              </Menu>
            }
          >
            <div title={userDisplayName} className={menubarClass.elem("user")}>
              <Userpic user={user} isInProgress={isLoading} />
              {showNewsletterDot && <div className={menubarClass.elem("userpic-badge")} />}
            </div>
          </Dropdown.Trigger>
        </div>
      )}

      <div className={contentClass.elem("body")}>
          {enabled && (
            <Dropdown
              ref={menuDropdownRef}
              onToggle={sidebarToggle}
              onVisibilityChanged={() => window.dispatchEvent(new Event("resize"))}
              visible={sidebarOpened}
              className={[sidebarClass, sidebarClass.mod({ floating: !sidebarPinned })].join(" ")}
              style={{ width: 240 }}
            >
              <Menu>
                {/* 首页菜单已屏蔽 */}
                {/* {isFF(FF_HOMEPAGE) && (
                  <Menu.Item label={t("menu.home")} to="/projects" icon={<IconHome />} data-external exact />
                )} */}
                <Menu.Item label={t("menu.projects")} to="/projects" icon={<IconFolder />} data-external exact />
                <Menu.Item
                  label={t("menu.organization")}
                  to="/organization"
                  icon={<IconPeople />}
                  data-external
                  exact
                />

                <Menu.Spacer />

                {/* 版本更新、API、文档、GitHub、Slack、当前版本 菜单已屏蔽 */}
                {/* <VersionNotifier showNewVersion /> */}
                {/* <Menu.Item
                  label={t("menu.api")}
                  href="https://api.labelstud.io/api-reference/introduction/getting-started"
                  icon={<IconTerminal />}
                  target="_blank"
                />
                <Menu.Item label={t("menu.docs")} href="https://labelstud.io/guide" icon={<IconBook />} target="_blank" />
                <Menu.Item
                  label={t("menu.github")}
                  href="https://github.com/HumanSignal/label-studio"
                  icon={<IconGithub />}
                  target="_blank"
                  rel="noreferrer"
                />
                <Menu.Item
                  label={t("menu.slackCommunity")}
                  href="https://slack.labelstud.io/?source=product-menu"
                  icon={<IconSlack />}
                  target="_blank"
                  rel="noreferrer"
                />
                <VersionNotifier showCurrentVersion /> */}

                <Menu.Divider />

                <Menu.Item
                  icon={<IconPin />}
                  className={sidebarClass.elem("pin")}
                  onClick={sidebarPin}
                  active={sidebarPinned}
                >
                  {sidebarPinned ? t("menu.unpinMenu") : t("menu.pinMenu")}
                </Menu.Item>
              </Menu>
            </Dropdown>
          )}

          <MenubarContext.Provider value={providerValue}>
            <div className={contentClass.elem("content").mod({ withSidebar: sidebarPinned && sidebarOpened })}>
              {children}
            </div>
          </MenubarContext.Provider>
        </div>
    </div>
  );
};
