import React, { useMemo } from "react";
import { Modal, Table, Tabs } from "antd";
import { observer } from "mobx-react";
import { useTranslation } from "react-i18next";

import { Hotkey } from "../../core/Hotkey";

import "./Settings.scss";
import { cn } from "../../utils/bem";
import { triggerResizeEvent } from "../../utils/utilities";

import EditorSettings from "../../core/settings/editorsettings";
import * as TagSettings from "./TagSettings";
import { IconClose } from "@humansignal/icons";
import { Checkbox, Toggle } from "@humansignal/ui";
import { FF_DEV_3873, isFF } from "../../utils/feature-flags";
import { ff } from "@humansignal/core";

const ALIASES = { plus: "=", minus: "-", ",": "¼" };
const applyAliases = (key) => key.split("+").map((k) => ALIASES[k] ?? k).join("+").toLowerCase();

const buildShortcutToElement = () => {
  const map = {};
  const preferAnnotation = (a, b) => {
    const isAnnotation = (e) => e.startsWith("annotation:");
    if (isAnnotation(a) && !isAnnotation(b)) return a;
    if (!isAnnotation(a) && isAnnotation(b)) return b;
    return b;
  };
  Object.entries(Hotkey.keymap || {}).forEach(([element, config]) => {
    const shortcuts = [config.key];
    if (config.mac) shortcuts.push(config.mac);
    shortcuts.forEach((s) => {
      if (s) {
        const normalized = applyAliases(s);
        const existing = map[normalized];
        map[normalized] = existing ? preferAnnotation(existing, element) : element;
      }
    });
  });
  return map;
};

const HotkeysDescription = () => {
  const { t } = useTranslation();
  const columns = [
    { title: t("labelingSettings.hotkeysTable.shortcut"), dataIndex: "combo", key: "combo" },
    { title: t("labelingSettings.hotkeysTable.description"), dataIndex: "descr", key: "descr" },
  ];

  const keyNamespaces = Hotkey.namespaces();
  const shortcutToElement = useMemo(buildShortcutToElement, []);

  const getData = (descr) =>
    Object.keys(descr)
      .filter((k) => descr[k])
      .map((k) => {
        const normalizedKey = applyAliases(k);
        const element = shortcutToElement[normalizedKey] || shortcutToElement[k.toLowerCase()];
        const i18nKey = element ? `hotkeys.hotkeys.${element.replace(/[:.]/g, "_")}.description` : null;
        const translatedDesc = i18nKey ? t(i18nKey) : null;
        const displayDesc = translatedDesc && translatedDesc !== i18nKey ? translatedDesc : descr[k];
        return {
          key: k,
          combo: k.split(",").map((keyGroup) => {
            return (
              <div className={cn("keys").elem("key-group").toClassName()} key={keyGroup}>
                {keyGroup
                  .trim()
                  .split("+")
                  .map((keyPart) => (
                    <kbd className={cn("keys").elem("key").toClassName()} key={keyPart}>
                      {keyPart}
                    </kbd>
                  ))}
              </div>
            );
          }),
          descr: displayDesc,
        };
      });

  return (
    <div className={cn("keys").toClassName()}>
      <Tabs size="small">
        {Object.entries(keyNamespaces).map(([ns, data]) => {
          if (Object.keys(data.descriptions).length === 0) {
            return null;
          }
          const tabLabel = (() => {
            const key = `labelingSettings.hotkeysTab.${ns}`;
            const translated = t(key);
            return translated !== key ? translated : (data.description ?? ns);
          })();
          return (
            <Tabs.TabPane key={ns} tab={tabLabel}>
              <Table columns={columns} dataSource={getData(data.descriptions)} size="small" />
            </Tabs.TabPane>
          );
        })}
      </Tabs>
    </div>
  );
};

const newUI = isFF(FF_DEV_3873) ? { newUI: true } : {};

const editorSettingsKeys = Object.keys(EditorSettings).filter((key) => {
  const flag = EditorSettings[key].flag;
  return flag ? ff.isActive(flag) : true;
});

if (isFF(FF_DEV_3873)) {
  const enableTooltipsIndex = editorSettingsKeys.findIndex((key) => key === "enableTooltips");
  const enableLabelTooltipsIndex = editorSettingsKeys.findIndex((key) => key === "enableLabelTooltips");

  // swap these in the array
  const tmp = editorSettingsKeys[enableTooltipsIndex];

  editorSettingsKeys[enableTooltipsIndex] = editorSettingsKeys[enableLabelTooltipsIndex];
  editorSettingsKeys[enableLabelTooltipsIndex] = tmp;
}

const SettingsTag = ({ children }) => {
  return <div className={cn("settings-tag").toClassName()}>{children}</div>;
};

const TAG_KEY_MAP = { "Text Tag": "textTag", "Image Tag": "imageTag" };

const GeneralSettings = observer(({ store }) => {
  const { t } = useTranslation();
  return (
    <div className={cn("settings").mod(newUI).toClassName()}>
      {editorSettingsKeys.map((obj, index) => {
        const optKey = `labelingSettings.options.${obj}`;
        const title = t(`${optKey}.title`);
        const description = t(`${optKey}.description`);
        const descriptionFallback = t(`${optKey}.descriptionFallback`);
        const displayTitle = title.startsWith("labelingSettings.") ? EditorSettings[obj].newUI.title : title;
        const displayDescription = description.startsWith("labelingSettings.") ? EditorSettings[obj].newUI.description : description;
        const displayDescriptionFallback =
          descriptionFallback.startsWith("labelingSettings.") ? EditorSettings[obj].description : descriptionFallback;
        return (
          <label className={cn("settings").elem("field").toClassName()} key={index}>
            {isFF(FF_DEV_3873) ? (
              <>
                <div className={cn("settings__label").toClassName()}>
                  <div className={cn("settings__label").elem("title").toClassName()}>
                    {displayTitle}
                    {EditorSettings[obj].newUI.tags?.split(",").map((tag) => (
                      <SettingsTag key={tag}>
                      {TAG_KEY_MAP[tag.trim()]
                        ? t(`labelingSettings.tags.${TAG_KEY_MAP[tag.trim()]}`)
                        : tag}
                    </SettingsTag>
                    ))}
                  </div>
                  <div className={cn("settings__label").elem("description").toClassName()}>
                    {displayDescription}
                  </div>
                </div>
                <Toggle
                  key={index}
                  checked={store.settings[obj]}
                  onChange={store.settings[EditorSettings[obj].onChangeEvent]}
                  description={displayDescriptionFallback}
                />
              </>
            ) : (
              <>
                <Checkbox
                  key={index}
                  checked={store.settings[obj]}
                  onChange={store.settings[EditorSettings[obj].onChangeEvent]}
                >
                  {displayDescriptionFallback}
                </Checkbox>
                <br />
              </>
            )}
          </label>
        );
      })}
    </div>
  );
});

const LayoutSettings = observer(({ store }) => {
  const { t } = useTranslation();
  return (
    <div className={cn("settings").mod(newUI).toClassName()}>
      <div className={cn("settings").elem("field").toClassName()}>
        <Checkbox
          checked={store.settings.bottomSidePanel}
          onChange={() => {
            store.settings.toggleBottomSP();
            setTimeout(triggerResizeEvent);
          }}
        >
          {t("labelingSettings.layout.moveSidepanelToBottom")}
        </Checkbox>
      </div>

      <div className={cn("settings").elem("field").toClassName()}>
        <Checkbox checked={store.settings.displayLabelsByDefault} onChange={store.settings.toggleSidepanelModel}>
          {t("labelingSettings.layout.displayLabelsByDefault")}
        </Checkbox>
      </div>

      <div className={cn("settings").elem("field").toClassName()}>
        <Checkbox
          value={t("labelingSettings.layout.showAnnotationsPanel")}
          defaultChecked={store.settings.showAnnotationsPanel}
          onChange={() => {
            store.settings.toggleAnnotationsPanel();
          }}
        >
          {t("labelingSettings.layout.showAnnotationsPanel")}
        </Checkbox>
      </div>

      <div className={cn("settings").elem("field").toClassName()}>
        <Checkbox
          value={t("labelingSettings.layout.showPredictionsPanel")}
          defaultChecked={store.settings.showPredictionsPanel}
          onChange={() => {
            store.settings.togglePredictionsPanel();
          }}
        >
          {t("labelingSettings.layout.showPredictionsPanel")}
        </Checkbox>
      </div>

      {/* Saved for future use */}
      {/* <div className={cn("settings").elem("field").toClassName()}>
        <Checkbox
          value="Show image in fullsize"
          defaultChecked={store.settings.imageFullSize}
          onChange={() => {
            store.settings.toggleImageFS();
          }}
        >
          Show image in fullsize
        </Checkbox>
      </div> */}
    </div>
  );
});

const Settings = {
  General: { tabKey: "general", component: GeneralSettings },
  Hotkeys: { tabKey: "hotkeys", component: HotkeysDescription },
};
if (!isFF(FF_DEV_3873)) {
  Settings.Layout = { tabKey: "layout", component: LayoutSettings };
}

const DEFAULT_ACTIVE = Object.keys(Settings)[0];

const DEFAULT_MODAL_SETTINGS = isFF(FF_DEV_3873)
  ? {
      name: "settings-modal",
      titleKey: "titleNew",
      closeIcon: <IconClose />,
    }
  : {
      name: "settings-modal-old",
      titleKey: "titleOld",
      bodyStyle: { paddingTop: "0" },
    };

export default observer(({ store }) => {
  const { t } = useTranslation();
  const modalTitle = t(`labelingSettings.modal.${DEFAULT_MODAL_SETTINGS.titleKey}`);
  const availableSettings = useMemo(() => {
    const availableTags = Object.values(store.annotationStore.names.toJSON());
    const settingsScreens = Object.values(TagSettings);

    return availableTags.reduce((res, tagName) => {
      const tagType = store.annotationStore.names.get(tagName).type;
      const settings = settingsScreens.find(({ tagName }) => tagName.toLowerCase() === tagType.toLowerCase());

      if (settings) res.push(settings);

      return res;
    }, []);
  }, []);

  return (
    <Modal
      className={cn(DEFAULT_MODAL_SETTINGS.name).toClassName()}
      open={store.showingSettings}
      onCancel={store.toggleSettings}
      footer=""
      title={modalTitle}
      closeIcon={DEFAULT_MODAL_SETTINGS.closeIcon}
      bodyStyle={DEFAULT_MODAL_SETTINGS.bodyStyle}
    >
      <Tabs defaultActiveKey={DEFAULT_ACTIVE}>
        {Object.entries(Settings).map(([key, { tabKey, component }]) => (
          <Tabs.TabPane tab={t(`labelingSettings.tabs.${tabKey}`)} key={key}>
            {React.createElement(component, { store })}
          </Tabs.TabPane>
        ))}
        {availableSettings.map((Page) => (
          <Tabs.TabPane tab={Page.title} key={Page.tagName}>
            <Page store={store} />
          </Tabs.TabPane>
        ))}
      </Tabs>
    </Modal>
  );
});
