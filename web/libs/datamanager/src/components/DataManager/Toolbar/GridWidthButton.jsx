import { inject } from "mobx-react";
import { useCallback, useState } from "react";
import { Button, ButtonGroup } from "@humansignal/ui";
import { Dropdown } from "@humansignal/ui";
import { Toggle } from "../../Common/Form";
import { IconSettings, IconMinus, IconPlus } from "@humansignal/icons";
import debounce from "lodash/debounce";

const injector = inject(({ store }) => {
  const view = store?.currentView;

  const cols = view.fieldsAsColumns ?? [];
  const hasImage = cols.some(({ type }) => type === "Image") ?? false;

  return {
    view,
    isGrid: view.type === "grid",
    gridWidth: view?.gridWidth,
    fitImagesToWidth: view?.gridFitImagesToWidth,
    hasImage,
    t: store?.t ?? ((k) => k),
  };
});

export const GridWidthButton = injector(({ view, isGrid, gridWidth, fitImagesToWidth, hasImage, t, size }) => {
  const [width, setWidth] = useState(gridWidth);

  const setGridWidthStore = debounce((value) => {
    view.setGridWidth(value);
  }, 200);

  const setGridWidth = useCallback(
    (width) => {
      const newWidth = Math.max(1, Math.min(width, 10));

      setWidth(newWidth);
      setGridWidthStore(newWidth);
    },
    [view],
  );

  const handleFitImagesToWidthToggle = useCallback(
    (e) => {
      view.setFitImagesToWidth(e.target.checked);
    },
    [view],
  );

  return isGrid ? (
    <Dropdown.Trigger
      content={
        <div className="p-tight min-w-wide space-y-base">
          <div className="grid grid-cols-[1fr_min-content] gap-base items-center">
            <span>{t("dataManager.columnsCount")}: {width}</span>
            <ButtonGroup collapsed={false}>
              <Button
                onClick={() => setGridWidth(width - 1)}
                disabled={width === 1}
                variant="neutral"
                look="outlined"
                leading={<IconMinus />}
                size="small"
                aria-label={t("dataManager.decreaseColumns")}
              />
              <Button
                onClick={() => setGridWidth(width + 1)}
                disabled={width === 10}
                variant="neutral"
                look="outlined"
                leading={<IconPlus />}
                size="small"
                aria-label={t("dataManager.increaseColumns")}
              />
            </ButtonGroup>
          </div>
          {hasImage && (
            <div className="grid grid-cols-[1fr_min-content] gap-base items-center">
              <span>{t("dataManager.fitImagesToWidth")}</span>
              <Toggle checked={fitImagesToWidth} onChange={handleFitImagesToWidthToggle} />
            </div>
          )}
        </div>
      }
    >
      <Button size={size} variant="neutral" look="outlined" aria-label={t("dataManager.gridSettings")}>
        <IconSettings />
      </Button>
    </Dropdown.Trigger>
  ) : null;
});
