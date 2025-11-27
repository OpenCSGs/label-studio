import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { StaticContent } from "../../app/StaticContent/StaticContent";
import {
  IconBook,
  IconFolder,
  IconHome,
  IconHotkeys,
  IconPersonInCircle,
  IconPin,
  IconTerminal,
  IconDoor,
  IconGithub,
  IconSettings,
  IconSlack,
  IconGlobe,
} from "@humansignal/icons";
import { LSLogo } from "../../assets/images";
import { Button, Userpic, ThemeToggle } from "@humansignal/ui";
import { useConfig } from "../../providers/ConfigProvider";
import {
  useContextComponent,
  useFixedLocation,
} from "../../providers/RoutesProvider";
import { useCurrentUser } from "../../providers/CurrentUser";
import { useAPI } from "../../providers/ApiProvider";
import { cn } from "../../utils/bem";
import { absoluteURL, isDefined } from "../../utils/helpers";
import { Breadcrumbs } from "../Breadcrumbs/Breadcrumbs";
import { Dropdown } from "../Dropdown/Dropdown";
import { Hamburger } from "../Hamburger/Hamburger";
import { Menu } from "../Menu/Menu";
import {
  VersionNotifier,
  VersionProvider,
} from "../VersionNotifier/VersionNotifier";
import "./Menubar.scss";
import "./MenuContent.scss";
import "./MenuSidebar.scss";
import { FF_HOMEPAGE } from "../../utils/feature-flags";
import { pages } from "@humansignal/app-common";
import { isFF } from "../../utils/feature-flags";
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

export const Menubar = ({
  enabled,
  defaultOpened,
  defaultPinned,
  children,
  onSidebarToggle,
  onSidebarPin,
}) => {
  const menuDropdownRef = useRef();
  const useMenuRef = useRef();
  const langMenuRef = useRef();
  const { user, fetch, isInProgress } = useCurrentUser();
  const location = useFixedLocation();
  const api = useAPI();
  const { i18n, t } = useTranslation();

  const config = useConfig();
  const [sidebarOpened, setSidebarOpened] = useState(defaultOpened ?? false);
  const [sidebarPinned, setSidebarPinned] = useState(defaultPinned ?? false);
  const [PageContext, setPageContext] = useState({
    Component: null,
    props: {},
  });
  const [logoUrl, setLogoUrl] = useState(null);
  const [useDefaultLogo, setUseDefaultLogo] = useState(false);

  const menubarClass = cn("menu-header");
  const menubarContext = menubarClass.elem("context");
  const sidebarClass = cn("sidebar");
  const contentClass = cn("content-wrapper");
  const contextItem = menubarClass.elem("context-item");
  const showNewsletterDot = !isDefined(user?.allow_newsletters);

  const handleLanguageChange = useCallback((lang) => {
    i18n.changeLanguage(lang);
    langMenuRef.current?.close();
  }, [i18n]);

  const sidebarPin = useCallback(
    (e) => {
      e.preventDefault();

      const newState = !sidebarPinned;

      setSidebarPinned(newState);
      onSidebarPin?.(newState);
    },
    [sidebarPinned]
  );

  const sidebarToggle = useCallback(
    (visible) => {
      const newState = visible;

      setSidebarOpened(newState);
      onSidebarToggle?.(newState);
    },
    [sidebarOpened]
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
    [PageContext]
  );

  useEffect(() => {
    if (!sidebarPinned) {
      menuDropdownRef?.current?.close();
    }
    useMenuRef?.current?.close();
  }, [location]);

  // 设置动态favicon
  useEffect(() => {
    const setFavicon = () => {
      try {
        // 从Local Storage读取origin
        const origin = localStorage.getItem('origin');

        if (origin) {
          // 构建favicon URL
          const faviconUrl = `${origin}/images/favicon.ico`;

          // 查找现有的favicon link标签
          let link = document.querySelector("link[rel*='icon']");

          if (!link) {
            // 如果不存在，创建新的link标签
            link = document.createElement('link');
            link.rel = 'shortcut icon';
            document.head.appendChild(link);
          }

          // 更新favicon的href
          link.href = faviconUrl;
        }
      } catch (error) {
        console.error('Error setting favicon:', error);
      }
    };

    setFavicon();
  }, []);

  // 获取动态logo
  useEffect(() => {
    const fetchLogo = async () => {
      try {
        // 从Local Storage读取origin
        const origin = localStorage.getItem('origin');

        // 使用框架的API调用方式
        const result = await api.callApi('systemConfig', {
          suppressError: true,
        });

        if (result && !result.error) {
          const data = result.response || result;
          const logoPath = data?.system_configs?.general_configs?.logo;

          if (logoPath) {
            // 拼接origin和logo路径
            const finalLogoUrl = origin ? `${origin}${logoPath}` : logoPath;
            setLogoUrl(finalLogoUrl);
            setUseDefaultLogo(false);
          } else {
            setUseDefaultLogo(true);
          }
        } else {
          setUseDefaultLogo(true);
        }
      } catch (error) {
        console.error('Error fetching logo:', error);
        // 如果获取失败，使用默认logo
        setUseDefaultLogo(true);
      }
    };

    fetchLogo();
  }, [api]);

  return (
    <div className={contentClass}>
      {enabled && (
        <div className={menubarClass}>
          <Dropdown.Trigger
            dropdown={menuDropdownRef}
            closeOnClickOutside={!sidebarPinned}
          >
            <div
              className={`${menubarClass.elem("trigger")} main-menu-trigger`}
            >
              {logoUrl && !useDefaultLogo ? (
                <img
                  src={logoUrl}
                  className={`${menubarClass.elem("logo")}`}
                  alt="Label Studio Logo"
                  onError={() => {
                    // 如果动态logo加载失败，使用默认logo
                    setUseDefaultLogo(true);
                    setLogoUrl(null);
                  }}
                />
              ) : (
                <LSLogo
                  className={`${menubarClass.elem("logo")}`}
                  alt="Label Studio Logo"
                />
              )}
              {/* <span>数据标注</span> */}
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

          {/* {ff.isActive(ff.FF_THEME_TOGGLE) && <ThemeToggle />} */}

          {/* <Dropdown.Trigger
            ref={useMenuRef}
            align="right"
            content={
              <Menu>
                <Menu.Item
                  icon={<IconSettings />}
                  label="Account &amp; Settings"
                  href={pages.AccountSettingsPage.path}
                />
                <Menu.Item
                  icon={<IconDoor />}
                  label="Log Out"
                  href={absoluteURL("/logout")}
                  data-external
                />
                {showNewsletterDot && (
                  <>
                    <Menu.Divider />
                    <Menu.Item
                      className={cn("newsletter-menu-item")}
                      href={pages.AccountSettingsPage.path}
                    >
                      <span>
                        Please check new notification settings in the Account &
                        Settings page
                      </span>
                      <span className={cn("newsletter-menu-badge")} />
                    </Menu.Item>
                  </>
                )}
              </Menu>
            }
          >
            <div title={user?.email} className={menubarClass.elem("user")}>
              <Userpic user={user} isInProgress={isInProgress} />
              {showNewsletterDot && (
                <div className={menubarClass.elem("userpic-badge")} />
              )}
            </div>
          </Dropdown.Trigger> */}
          <div title={user?.email} className={menubarClass.elem("user")}>
            <Userpic user={user} isInProgress={isInProgress} />
            {showNewsletterDot && (
              <div className={menubarClass.elem("userpic-badge")} />
            )}
          </div>
        </div>
      )}

      <VersionProvider>
        <div className={contentClass.elem("body")}>
          {enabled && (
            <Dropdown
              ref={menuDropdownRef}
              onToggle={sidebarToggle}
              onVisibilityChanged={() =>
                window.dispatchEvent(new Event("resize"))
              }
              visible={sidebarOpened}
              className={[
                sidebarClass,
                sidebarClass.mod({ floating: !sidebarPinned }),
              ].join(" ")}
              style={{ width: 240 }}
            >
              <Menu>
                {isFF(FF_HOMEPAGE) && (
                  <Menu.Item
                    label={t("menu.home")}
                    to="/"
                    icon={<IconHome />}
                    data-external
                    exact
                  />
                )}
                <Menu.Item
                  label={t("menu.projects")}
                  to="/projects"
                  icon={<IconFolder />}
                  data-external
                  exact
                />
                <Menu.Item
                  label={t("menu.organization")}
                  to="/organization"
                  icon={<IconPersonInCircle />}
                  data-external
                  exact
                />

                <Menu.Spacer />

                <VersionNotifier showNewVersion />

                {/* <Menu.Item
                  label="API"
                  href="https://api.labelstud.io/api-reference/introduction/getting-started"
                  icon={<IconTerminal />}
                  target="_blank"
                />
                <Menu.Item label="Docs" href="https://labelstud.io/guide" icon={<IconBook />} target="_blank" />
                <Menu.Item
                  label="GitHub"
                  href="https://github.com/HumanSignal/label-studio"
                  icon={<IconGithub />}
                  target="_blank"
                  rel="noreferrer"
                />
                <Menu.Item
                  label="Slack Community"
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
            <div
              className={contentClass
                .elem("content")
                .mod({ withSidebar: sidebarPinned && sidebarOpened })}
            >
              {children}
            </div>
          </MenubarContext.Provider>
        </div>
      </VersionProvider>
    </div>
  );
};
