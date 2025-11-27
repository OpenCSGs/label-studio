import { observer } from "mobx-react";
import { useTranslation } from "react-i18next";
import { Block, Elem } from "../../../utils/bem";

export type RegionLabelProps = {
  item: any;
};
export const RegionLabel = observer(({ item }: RegionLabelProps) => {
  const { t } = useTranslation();
  const { type } = item ?? {};
  if (!type) {
    return t("annotation.noLabel");
  }
  if (type.includes("label")) {
    return item.value;
  }
  if (type.includes("region") || type.includes("range")) {
    const labelsInResults = item.labelings.map((result: any) => result.selectedLabels || []);

    const labels: any[] = [].concat(...labelsInResults);

    return (
      <Block name="labels-list">
        {labels.map((label, index) => {
          const color = label.background || "#000000";

          return [
            index ? ", " : null,
            <Elem key={label.id} style={{ color }}>
              {label.value || t("annotation.noLabel")}
            </Elem>,
          ];
        })}
      </Block>
    );
  }
  if (type.includes("tool")) {
    return item.value;
  }
});
