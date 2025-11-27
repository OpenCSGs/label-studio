import { inject } from "mobx-react";
import { useTranslation } from "react-i18next";
import { IconChevronLeft } from "@humansignal/icons";
import { Block, Elem } from "../../../utils/bem";
import { Button } from "@humansignal/ui";
import { Filters } from "../Filters";
import "./FilterSidebar.scss";

const sidebarInjector = inject(({ store }) => {
  const viewsStore = store.viewsStore;

  return {
    viewsStore,
    sidebarEnabled: viewsStore?.sidebarEnabled,
    sidebarVisible: viewsStore?.sidebarVisible,
  };
});

export const FiltersSidebar = sidebarInjector(({ viewsStore, sidebarEnabled, sidebarVisible }) => {
  const { t } = useTranslation();
  return sidebarEnabled && sidebarVisible ? (
    <Block name="filters-sidebar">
      <Elem name="header">
        <Elem name="extra">
          <Button
            look="string"
            onClick={() => viewsStore.collapseFilters()}
            tooltip={t("dataManager.unpinFilters")}
            aria-label={t("dataManager.unpinFilters")}
          >
            <IconChevronLeft width={24} height={24} />
          </Button>
          <Elem name="title">{t("dataManager.filters")}</Elem>
        </Elem>
        <Filters sidebar={true} />
      </Elem>
    </Block>
  ) : null;
});
FiltersSidebar.displayName = "FiltersSidebar";
