import { inject } from "mobx-react";
import React from "react";
import { useTranslation } from "react-i18next";
import { Block, cn, Elem } from "../../utils/bem";
import { Button } from "@humansignal/ui";
import { FilterLine } from "./FilterLine/FilterLine";
import { IconChevronRight, IconPlus } from "@humansignal/icons";
import "./Filters.scss";

const injector = inject(({ store }) => ({
  store,
  views: store.viewsStore,
  currentView: store.currentView,
  filters: store.currentView?.currentFilters ?? [],
}));

export const Filters = injector(({ views, currentView, filters }) => {
  const { t } = useTranslation();
  const { sidebarEnabled } = views;

  const fields = React.useMemo(
    () =>
      currentView.availableFilters.reduce((res, filter) => {
        const target = filter.field.target;
        const groupTitle = target
          .split("_")
          .map((s) =>
            s
              .split("")
              .map((c, i) => (i === 0 ? c.toUpperCase() : c))
              .join(""),
          )
          .join(" ");

        const group = res[target] ?? {
          id: target,
          title: groupTitle,
          options: [],
        };

        group.options.push({
          value: filter.id,
          title: filter.field.title,
          original: filter,
        });

        return { ...res, [target]: group };
      }, {}),
    [currentView.availableFilters],
  );

  return (
    <Block name="filters" mod={{ sidebar: sidebarEnabled }}>
      <Elem name="list" mod={{ withFilters: !!filters.length }}>
        {filters.length ? (
          filters.map((filter, i) => (
            <FilterLine
              index={i}
              filter={filter}
              view={currentView}
              sidebar={sidebarEnabled}
              value={filter.currentValue}
              key={`${filter.filter.id}-${i}`}
              availableFilters={Object.values(fields)}
              dropdownClassName={cn("filters").elem("selector")}
            />
          ))
        ) : (
          <Elem name="empty">{t("dataManager.noFiltersApplied")}</Elem>
        )}
      </Elem>
      <Elem name="actions">
        <Button
          size="small"
          look="string"
          onClick={() => currentView.createFilter()}
          leading={<IconPlus className="!h-3 !w-3" />}
        >
          {filters.length ? t("dataManager.addAnotherFilter") : t("dataManager.addFilter")}
        </Button>

        {!sidebarEnabled ? (
          <Button
            look="string"
            type="link"
            size="small"
            tooltip={t("dataManager.pinToSidebar")}
            onClick={() => views.expandFilters()}
            aria-label={t("dataManager.pinFiltersToSidebar")}
          >
            <IconChevronRight className="!w-4 !h-4" />
          </Button>
        ) : null}
      </Elem>
    </Block>
  );
});
