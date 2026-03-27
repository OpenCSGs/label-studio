import { inject } from "mobx-react";
import { IconChevronDown } from "@humansignal/icons";
import { cn } from "../../../utils/bem";
import { FF_SELF_SERVE, isFF } from "../../../utils/feature-flags";
import { ErrorBox } from "../../Common/ErrorBox";
import { FieldsButton } from "../../Common/FieldsButton";
import { FiltersPane } from "../../Common/FiltersPane";
import { Icon } from "../../Common/Icon/Icon";
import { Interface } from "../../Common/Interface";
import { ExportButton, ImportButton } from "../../Common/SDKButtons";
import { Tooltip } from "@humansignal/ui";
import { ActionsButton } from "./ActionsButton";
import { DensityToggle } from "./DensityToggle";
import { GridWidthButton } from "./GridWidthButton";
import { LabelButton } from "./LabelButton";
import { LoadingPossum } from "./LoadingPossum";
import { OrderButton } from "./OrderButton";
import { RefreshButton } from "./RefreshButton";
import { ViewToggle } from "./ViewToggle";

const style = {
  minWidth: "80px",
  justifyContent: "space-between",
};

const ColumnsButtonWithT = inject(({ store }) => ({
  t: store?.t ?? ((k) => k),
}))(({ t, size, iconProps }) => (
  <FieldsButton
    wrapper={FieldsButton.Checkbox}
    trailingIcon={<Icon {...iconProps} />}
    title={t("dataManager.columns")}
    size={size}
    style={style}
    openUpwardForShortViewport={false}
  />
));

const ImportButtonWithChecksWrapper = inject(({ store }) => ({
  t: store?.t ?? ((k) => k),
}))(({ t, size }) => <ImportButtonWithChecks size={size} t={t} />);

const ExportButtonWithT = inject(({ store }) => ({
  t: store?.t ?? ((k) => k),
}))(({ t, size }) => (
  <ExportButton size={size}>{t("dataManager.export")}</ExportButton>
));

/**
 * Checks for Starter Cloud trial expiration.
 * If expired it renders disabled Import button with a tooltip.
 */
const ImportButtonWithChecks = ({ size, t }) => {
  const simpleButton = <ImportButton size={size}>{t("dataManager.import")}</ImportButton>;
  const isOpenSource = !window.APP_SETTINGS.billing;
  // Check if user is self-serve; Enterprise flag === false is the main condition
  const isSelfServe = isFF(FF_SELF_SERVE) && window.APP_SETTINGS.billing?.enterprise === false;

  if (isOpenSource || !isSelfServe) return simpleButton;

  // Check if user is on trial
  const isTrialExpired = window.APP_SETTINGS.billing.checks?.is_license_expired;
  // Check the subscription period end date
  const subscriptionPeriodEnd = window.APP_SETTINGS.subscription?.current_period_end;
  // Check if user is self-serve and has expired trial
  const isSelfServeExpiredTrial = isSelfServe && isTrialExpired && !subscriptionPeriodEnd;
  // Check if user is self-serve and has expired subscription
  const isSelfServeExpiredSubscription =
    isSelfServe && subscriptionPeriodEnd && new Date(subscriptionPeriodEnd) < new Date();
  // Check if user is self-serve and has expired trial or subscription
  const isSelfServeExpired = isSelfServeExpiredTrial || isSelfServeExpiredSubscription;

  if (!isSelfServeExpired) return simpleButton;

  // Disabled buttons ignore hover, so we use wrapper to properly handle a tooltip
  return (
    <Tooltip
      title={t("dataManager.upgradeToImport")}
      style={{
        maxWidth: 200,
        textAlign: "center",
      }}
    >
      <div className={cn("button-wrapper").toClassName()}>
        <ImportButton disabled size={size}>
          {t("dataManager.import")}
        </ImportButton>
      </div>
    </Tooltip>
  );
};

export const instruments = {
  "view-toggle": ({ size }) => {
    return <ViewToggle size={size} style={style} />;
  },
  "density-toggle": ({ size }) => {
    return <DensityToggle size={size} />;
  },
  columns: ({ size }) => {
    const iconProps = {
      style: { marginRight: 4 },
      icon: IconChevronDown,
    };
    return (
      <ColumnsButtonWithT
        iconProps={iconProps}
        size={size}
      />
    );
  },
  filters: ({ size }) => {
    return <FiltersPane size={size} style={style} />;
  },
  ordering: ({ size }) => {
    return <OrderButton size={size} style={style} />;
  },
  "grid-size": ({ size }) => {
    return <GridWidthButton size={size} />;
  },
  refresh: ({ size }) => {
    return <RefreshButton size={size} />;
  },
  "loading-possum": () => {
    return <LoadingPossum />;
  },
  "label-button": ({ size }) => {
    return <LabelButton size={size} />;
  },
  actions: ({ size }) => {
    return <ActionsButton size={size} style={style} />;
  },
  "error-box": () => {
    return <ErrorBox />;
  },
  "import-button": ({ size }) => {
    return (
      <Interface name="import">
        <ImportButtonWithChecksWrapper size={size} />
      </Interface>
    );
  },
  "export-button": ({ size }) => {
    return (
      <Interface name="export">
        <ExportButtonWithT size={size} />
      </Interface>
    );
  },
};
