import React, { useMemo } from "react";
import { Modal, Table, Tabs } from "antd";
import { observer } from "mobx-react";
import { useTranslation } from "react-i18next";

import { Hotkey } from "../../core/Hotkey";

import "./Settings.scss";
import { Block, Elem } from "../../utils/bem";
import { isMacOS, triggerResizeEvent } from "../../utils/utilities";

import EditorSettings from "../../core/settings/editorsettings";
import * as TagSettings from "./TagSettings";
import { IconClose } from "@humansignal/icons";
import { Checkbox, Toggle } from "@humansignal/ui";
import { FF_DEV_3873, isFF } from "../../utils/feature-flags";
import { ff } from "@humansignal/core";

/** 与 Hotkey 中 applyAliases 一致：plus->=, minus->-, 用于反查时与 _hotkeys_map 中已归一化的 key 匹配 */
const ALIASES = { plus: "=", minus: "-", ",": "¼" };
const normalizeShortcutWithAliases = (shortcut) => {
  if (!shortcut) return "";
  return shortcut
    .toLowerCase()
    .split("+")
    .map((k) => ALIASES[k.trim()] ?? k.trim())
    .join("+");
};

/** 根据快捷键和描述从 keymap 反查 keymap 名称（如 annotation:submit），用于 i18n 查找 */
const findKeymapNameByShortcut = (shortcut, description) => {
  const keymap = Hotkey.keymap || {};
  const normalizedInput = normalizeShortcutWithAliases(shortcut);
  for (const [name, entry] of Object.entries(keymap)) {
    const rawShortcut = (isMacOS() ? entry.mac ?? entry.key : entry.key) ?? "";
    const normalizedKeymap = normalizeShortcutWithAliases(rawShortcut);
    if (normalizedKeymap === normalizedInput && entry.description === description) return name;
  }
  return null;
};

const HotkeysDescription = () => {
  const { t } = useTranslation();
  const columns = [
    { title: t("labelingSettings.hotkeysTable.shortcut"), dataIndex: "combo", key: "combo" },
    { title: t("labelingSettings.hotkeysTable.description"), dataIndex: "descr", key: "descr" },
  ];

  const keyNamespaces = Hotkey.namespaces();

  const getData = (descr) =>
    Object.keys(descr)
      .filter((k) => descr[k])
      .map((k) => {
        const rawDesc = descr[k];
        const keymapName = findKeymapNameByShortcut(k, rawDesc);
        const i18nKey = keymapName
          ? `hotkeys.hotkeys.${keymapName.replace(/:/g, ".")}.description`
          : null;
        return {
          key: k,
          combo: k.split(",").map((keyGroup) => {
            return (
              <Elem name="key-group" key={keyGroup}>
                {keyGroup
                  .trim()
                  .split("+")
                  .map((key) => (
                    <Elem tag="kbd" name="key" key={key}>
                      {key}
                    </Elem>
                  ))}
              </Elem>
            );
          }),
          descr: i18nKey ? t(i18nKey, { defaultValue: rawDesc }) : rawDesc,
        };
      });

  return (
    <Block name="keys">
      <Tabs size="small">
        {Object.entries(keyNamespaces).map(([ns, data]) => {
          if (Object.keys(data.descriptions).length === 0) {
            return null;
          }
          return (
            <Tabs.TabPane
              key={ns}
              tab={t(`labelingSettings.hotkeysTab.${ns}`, { defaultValue: data.description ?? ns })}
            >
              <Table columns={columns} dataSource={getData(data.descriptions)} size="small" />
            </Tabs.TabPane>
          );
        })}
      </Tabs>
    </Block>
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
  return <Block name="settings-tag">{children}</Block>;
};

const GeneralSettings = observer(({ store }) => {
  const { t } = useTranslation();
  return (
    <Block name="settings" mod={newUI}>
      {editorSettingsKeys.map((obj, index) => {
        return (
          <Elem name="field" tag="label" key={index}>
            {isFF(FF_DEV_3873) ? (
              <>
                <Block name="settings__label">
                  <Elem name="title">
                    {t(`labelingSettings.options.${obj}.title`, { defaultValue: EditorSettings[obj].newUI?.title })}
                    {EditorSettings[obj].newUI?.tags?.split(",").map((tag) => (
                      <SettingsTag key={tag}>{tag}</SettingsTag>
                    ))}
                  </Elem>
                  <Elem name="description">
                    {t(`labelingSettings.options.${obj}.description`, { defaultValue: EditorSettings[obj].newUI?.description })}
                  </Elem>
                </Block>
                <Toggle
                  key={index}
                  checked={store.settings[obj]}
                  onChange={store.settings[EditorSettings[obj].onChangeEvent]}
                  description={t(`labelingSettings.options.${obj}.descriptionFallback`, { defaultValue: EditorSettings[obj].description })}
                />
              </>
            ) : (
              <>
                <Checkbox
                  key={index}
                  checked={store.settings[obj]}
                  onChange={store.settings[EditorSettings[obj].onChangeEvent]}
                >
                  {t(`labelingSettings.options.${obj}.descriptionFallback`, { defaultValue: EditorSettings[obj].description })}
                </Checkbox>
                <br />
              </>
            )}
          </Elem>
        );
      })}
    </Block>
  );
});

const LayoutSettings = observer(({ store }) => {
  const { t } = useTranslation();
  return (
    <Block name="settings" mod={newUI}>
      <Elem name="field">
        <Checkbox
          checked={store.settings.bottomSidePanel}
          onChange={() => {
            store.settings.toggleBottomSP();
            setTimeout(triggerResizeEvent);
          }}
        >
          {t("labelingSettings.layout.moveSidepanelToBottom")}
        </Checkbox>
      </Elem>

      <Elem name="field">
        <Checkbox checked={store.settings.displayLabelsByDefault} onChange={store.settings.toggleSidepanelModel}>
          {t("labelingSettings.layout.displayLabelsByDefault")}
        </Checkbox>
      </Elem>

      <Elem name="field">
        <Checkbox
          value={t("labelingSettings.layout.showAnnotationsPanel")}
          defaultChecked={store.settings.showAnnotationsPanel}
          onChange={() => {
            store.settings.toggleAnnotationsPanel();
          }}
        >
          {t("labelingSettings.layout.showAnnotationsPanel")}
        </Checkbox>
      </Elem>

      <Elem name="field">
        <Checkbox
          value={t("labelingSettings.layout.showPredictionsPanel")}
          defaultChecked={store.settings.showPredictionsPanel}
          onChange={() => {
            store.settings.togglePredictionsPanel();
          }}
        >
          {t("labelingSettings.layout.showPredictionsPanel")}
        </Checkbox>
      </Elem>

      {/* Saved for future use */}
      {/* <Elem name="field">
        <Checkbox
          value="Show image in fullsize"
          defaultChecked={store.settings.imageFullSize}
          onChange={() => {
            store.settings.toggleImageFS();
          }}
        >
          Show image in fullsize
        </Checkbox>
      </Elem> */}
    </Block>
  );
});

const Settings = {
  General: { name: "General", component: GeneralSettings },
  Hotkeys: { name: "Hotkeys", component: HotkeysDescription },
};

if (!isFF(FF_DEV_3873)) {
  Settings.Layout = { name: "Layout", component: LayoutSettings };
}

const DEFAULT_ACTIVE = Object.keys(Settings)[0];

const getDefaultModalSettings = (t) =>
  isFF(FF_DEV_3873)
    ? {
        name: "settings-modal",
        title: t("labelingSettings.modal.titleNew"),
        closeIcon: <IconClose />,
      }
    : {
        name: "settings-modal-old",
        title: t("labelingSettings.modal.titleOld"),
        bodyStyle: { paddingTop: "0" },
      };

export default observer(({ store }) => {
  const { t } = useTranslation();
  const defaultModalSettings = getDefaultModalSettings(t);
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
    <Block
      tag={Modal}
      open={store.showingSettings}
      onCancel={store.toggleSettings}
      footer=""
      {...defaultModalSettings}
    >
      <Tabs defaultActiveKey={DEFAULT_ACTIVE}>
        {Object.entries(Settings).map(([key, { name, component }]) => (
          <Tabs.TabPane tab={t(`labelingSettings.tabs.${key.toLowerCase()}`)} key={key}>
            {React.createElement(component, { store })}
          </Tabs.TabPane>
        ))}
        {availableSettings.map((Page) => (
          <Tabs.TabPane tab={Page.title} key={Page.tagName}>
            <Page store={store} />
          </Tabs.TabPane>
        ))}
      </Tabs>
    </Block>
  );
});
