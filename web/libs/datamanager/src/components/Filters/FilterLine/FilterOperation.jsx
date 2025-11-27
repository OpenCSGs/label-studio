import { observer } from "mobx-react";
import { getRoot } from "mobx-state-tree";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Elem } from "../../../utils/bem";
import { debounce } from "../../../utils/debounce";
import { FilterDropdown } from "../FilterDropdown";
import * as FilterInputs from "../types";
import { allowedFilterOperations } from "../types/Utility";
import { Common } from "../types/Common";

/** @typedef {{
 * type: keyof typeof FilterInputs,
 * width: number
 * }} FieldConfig */

/**
 *
 * @param {{field: FieldConfig}} param0
 */
export const FilterOperation = observer(({ filter, field, operator, value, disabled }) => {
  const { t } = useTranslation();
  const cellView = filter.cellView;
  const types = cellView?.customOperators ?? [
    ...(FilterInputs[filter.filter.currentType] ?? FilterInputs.String),
    ...Common,
  ];

  const selected = useMemo(() => {
    let result;

    if (operator) {
      result = types.find((t) => t.key === operator);
    }

    if (!result) {
      result = types[0];
    }

    filter.setOperator(result.key);
    return result;
  }, [operator, types, filter]);

  const saveFilter = useCallback(
    debounce(() => {
      filter.save(true);
    }, 300),
    [filter],
  );

  const onChange = (newValue) => {
    filter.setValue(newValue);
    saveFilter();
  };

  const onOperatorSelected = (selectedKey) => {
    filter.setOperator(selectedKey);
  };
  const availableOperators = filter.cellView?.filterOperators;
  const Input = selected?.input;
  let operatorList = allowedFilterOperations(types, getRoot(filter)?.SDK?.type);
  if (filter.filter.field.isAnnotationResultsFilterColumn) {
    // We want at most one of "equal" or "contains" per filter type
    // They resolve to the same backend query in this custom case
    const hasEqualOperators = operatorList.some((o) => ["equal", "not_equal"].includes(o.key));
    const allowedOperators = hasEqualOperators ? ["equal", "not_equal"] : ["contains", "not_contains"];
    operatorList = operatorList.filter((op) => allowedOperators.includes(op.key));
  }
  const operators = operatorList.map(({ key, label }) => {
    // Translate common operator labels
    // For date filters, use date-specific translations for "less" and "greater"
    const isDateFilter = filter.filter.currentType === "Date" || filter.filter.currentType === "Datetime";
    let translationKey = `dataManager.filterOperator.${key}`;
    
    // Special handling for date filters
    if (isDateFilter && key === "less") {
      translationKey = "dataManager.filterOperator.isBefore";
    } else if (isDateFilter && key === "greater") {
      translationKey = "dataManager.filterOperator.isAfter";
    }
    
    const translatedLabel = t(translationKey);
    // Use translation if available, otherwise use original label
    // For symbols like "=", "<", ">", etc., keep the original label
    let finalLabel = translatedLabel !== translationKey ? translatedLabel : label;
    
    if (filter.filter.field.isAnnotationResultsFilterColumn) {
      if (key === "contains") finalLabel = t("dataManager.includesAll");
      if (key === "not_contains") finalLabel = t("dataManager.doesNotIncludeAll");
    }
    return { value: key, label: finalLabel };
  });

  return Input ? (
    <>
      <Elem block="filter-line" name="column" mix="operation">
        <FilterDropdown
          placeholder={t("dataManager.condition")}
          value={filter.operator}
          disabled={types.length === 1 || disabled}
          items={availableOperators ? operators.filter((op) => availableOperators.includes(op.value)) : operators}
          onChange={onOperatorSelected}
        />
      </Elem>
      <Elem block="filter-line" name="column" mix="value">
        <Input
          {...field}
          key={`${filter.filter.id}-${filter.filter.currentType}`}
          schema={filter.schema}
          filter={filter}
          value={value}
          onChange={onChange}
          size="small"
          disabled={disabled}
        />
      </Elem>
    </>
  ) : null;
});
