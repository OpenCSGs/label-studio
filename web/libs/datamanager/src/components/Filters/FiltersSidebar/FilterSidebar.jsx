import { inject } from "mobx-react";
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
  return sidebarEnabled && sidebarVisible ? (
    <Block name="filters-sidebar">
      <Elem name="header">
        <Elem name="extra">
          <Button
            look="string"
            onClick={() => viewsStore.collapseFilters()}
            tooltip="Unpin filters"
            aria-label="Unpin filters"
          >
            <IconChevronLeft width={24} height={24} />
          </Button>
          <Elem name="title">Filters</Elem>
        </Elem>
        <Filters sidebar={true} />
      </Elem>
    </Block>
  ) : null;
});
FiltersSidebar.displayName = "FiltersSidebar";
