import { observer } from "mobx-react";
import { type FC, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Block, Elem } from "../../../utils/bem";
import { PanelBase, type PanelProps } from "../PanelBase";
import { OutlinerTree } from "./OutlinerTree";
import { ViewControls } from "./ViewControls";
import "./OutlinerPanel.scss";
import { IconInfo } from "@humansignal/icons";
import { IconLsLabeling } from "@humansignal/ui";
import { EmptyState } from "../Components/EmptyState";
import { getDocsUrl } from "../../../utils/docs";

// Local type definitions based on ViewControls and RegionStore
type GroupingOptions = "manual" | "label" | "type";
type OrderingOptions = "score" | "date";
type Region = {
  id: string;
  [key: string]: any; // Allow other properties for flexibility
};

interface OutlinerPanelProps extends PanelProps {
  regions: any;
}

interface OutlinerTreeComponentProps {
  regions: any;
}

const OutlinerFFClasses: string[] = [];

OutlinerFFClasses.push("ff_hide_all_regions");

const OutlinerPanelComponent: FC<OutlinerPanelProps> = ({ regions, ...props }) => {
  const [group, setGroup] = useState<GroupingOptions>(regions.group);
  const onOrderingChange = useCallback(
    (value: OrderingOptions) => {
      regions.setSort(value);
    },
    [regions],
  );

  const onGroupingChange = useCallback(
    (value: GroupingOptions) => {
      regions.setGrouping(value);
      setGroup(value);
    },
    [regions],
  );

  const onFilterChange = useCallback(
    (value: Region[] | null) => {
      regions.setFilteredRegions(value);
    },
    [regions],
  );

  useEffect(() => {
    setGroup(regions.group);
  }, []);

  regions.setGrouping(group);

  const { t } = useTranslation();
  return (
    <PanelBase {...props} name="outliner" mix={OutlinerFFClasses} title={t("annotation.outliner")}>
      <ViewControls
        ordering={regions.sort}
        regions={regions}
        orderingDirection={regions.sortOrder}
        onOrderingChange={onOrderingChange}
        onGroupingChange={onGroupingChange}
        onFilterChange={onFilterChange}
      />
      <OutlinerTreeComponent regions={regions} />
    </PanelBase>
  );
};

const OutlinerStandAlone: FC<OutlinerPanelProps> = ({ regions }) => {
  const onOrderingChange = useCallback(
    (value: OrderingOptions) => {
      regions.setSort(value);
    },
    [regions],
  );

  const onGroupingChange = useCallback(
    (value: GroupingOptions) => {
      regions.setGrouping(value);
    },
    [regions],
  );

  const onFilterChange = useCallback(
    (value: Region[] | null) => {
      regions.setFilteredRegions(value);
    },
    [regions],
  );

  return (
    <Block name="outliner" mix={OutlinerFFClasses}>
      <ViewControls
        ordering={regions.sort}
        regions={regions}
        orderingDirection={regions.sortOrder}
        onOrderingChange={onOrderingChange}
        onGroupingChange={onGroupingChange}
        onFilterChange={onFilterChange}
      />
      <OutlinerTreeComponent regions={regions} />
    </Block>
  );
};

const OutlinerEmptyState = () => {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={<IconLsLabeling width={24} height={24} />}
      header={t("annotation.labeledRegionsWillAppearHere")}
      description={
        <>
          <span>
            {t("annotation.startLabelingAndTrackResults")}
            <br />
            {t("annotation.usingThisPanel")}
          </span>
        </>
      }
      learnMore={{ href: getDocsUrl("guide/labeling"), text: t("annotation.learnMore"), testId: "regions-panel-learn-more" }}
    />
  );
};

const OutlinerTreeComponent: FC<OutlinerTreeComponentProps> = observer(({ regions }) => {
  const { t } = useTranslation();
  const allRegionsHidden = regions?.regions?.length > 0 && regions?.filter?.length === 0;

  const hiddenRegions = useMemo(() => {
    if (!regions?.regions?.length || !regions.filter?.length) return 0;

    return regions?.regions?.length - regions?.filter?.length;
  }, [regions?.regions?.length, regions?.filter?.length]);

  return (
    <>
      {allRegionsHidden ? (
        <Block name="filters-info">
          <IconInfo width={21} height={20} />
          <Elem name="filters-title">{t("annotation.allRegionsHidden")}</Elem>
          <Elem name="filters-description">{t("annotation.adjustOrRemoveFiltersToView")}</Elem>
        </Block>
      ) : regions?.regions?.length > 0 ? (
        <>
          <OutlinerTree
            regions={regions}
            footer={
              hiddenRegions > 0 && (
                <Block name="filters-info">
                  <IconInfo width={21} height={20} />
                  <Elem name="filters-title">
                    {hiddenRegions === 1 
                      ? t("annotation.hiddenRegionSingular", { count: hiddenRegions })
                      : t("annotation.hiddenRegionsPlural", { count: hiddenRegions })}
                  </Elem>
                  <Elem name="filters-description">{t("annotation.adjustOrRemoveFiltersToView")}</Elem>
                </Block>
              )
            }
          />
        </>
      ) : (
        <OutlinerEmptyState />
      )}
    </>
  );
});

export const OutlinerComponent = observer(OutlinerStandAlone);

export const OutlinerPanel = observer(OutlinerPanelComponent);
