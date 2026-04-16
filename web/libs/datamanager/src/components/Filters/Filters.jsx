import { inject } from "mobx-react";
import React from "react";
import { cn } from "../../utils/bem";
import { Button } from "@humansignal/ui";
import { FilterLine } from "./FilterLine/FilterLine";
import { IconChevronRight, IconPlus } from "@humansignal/icons";
import { getColumnTitle } from "../../utils/column-i18n";
import "./Filters.scss";

const injector = inject(({ store }) => ({
  store,
  views: store.viewsStore,
  currentView: store.currentView,
  filters: store.currentView?.currentFilters ?? [],
  t: store?.t ?? ((k) => k),
}));

export const Filters = injector(({ views, currentView, filters, t }) => {
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
          title: getColumnTitle(filter.field, filter.field.title, t),
          original: filter,
        });

        return { ...res, [target]: group };
      }, {}),
    [currentView.availableFilters, t],
  );

  return (
    <div className={cn("filters").mod({ sidebar: sidebarEnabled }).toClassName()}>
      <div className={cn("filters").elem("list").mod({ withFilters: !!filters.length }).toClassName()}>
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
              dropdownClassName={cn("filters").elem("selector").toClassName()}
              t={t}
            />
          ))
        ) : (
          <div className={cn("filters").elem("empty").toClassName()}>{t("dataManager.noFiltersApplied")}</div>
        )}
      </div>
      <div className={cn("filters").elem("actions").toClassName()}>
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
      </div>
    </div>
  );
});
