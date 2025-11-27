import { inject, observer } from "mobx-react";
import { RadioGroup } from "../../Common/RadioGroup/RadioGroup";
import { IconGrid, IconList } from "@humansignal/icons";
import { Tooltip } from "@humansignal/ui";
import { useTranslation } from "react-i18next";

const viewInjector = inject(({ store }) => ({
  view: store.currentView,
}));

export const ViewToggle = viewInjector(
  observer(({ view, size, ...rest }) => {
    const { t } = useTranslation();
    return (
      <RadioGroup
        size={size}
        value={view.type}
        onChange={(e) => view.setType(e.target.value)}
        {...rest}
        style={{ "--button-padding": "0 var(--spacing-tighter)" }}
      >
        <Tooltip title={t("dataManager.listView")}>
          <div>
            <RadioGroup.Button value="list" aria-label={t("dataManager.switchToListView")}>
              <IconList />
            </RadioGroup.Button>
          </div>
        </Tooltip>
        <Tooltip title={t("dataManager.gridView")}>
          <div>
            <RadioGroup.Button value="grid" aria-label={t("dataManager.switchToGridView")}>
              <IconGrid />
            </RadioGroup.Button>
          </div>
        </Tooltip>
      </RadioGroup>
    );
  }),
);

export const DataStoreToggle = viewInjector(({ view, size, ...rest }) => {
  const { t } = useTranslation();
  return (
    <RadioGroup value={view.target} size={size} onChange={(e) => view.setTarget(e.target.value)} {...rest}>
      <RadioGroup.Button value="tasks">{t("dataManager.tasks")}</RadioGroup.Button>
      <RadioGroup.Button value="annotations" disabled>
        {t("dataManager.annotations")}
      </RadioGroup.Button>
    </RadioGroup>
  );
});
