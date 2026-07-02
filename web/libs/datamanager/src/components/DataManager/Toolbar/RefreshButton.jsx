import { inject } from "mobx-react";
import { IconRefresh } from "@humansignal/icons";
import { Button } from "@humansignal/ui";

const injector = inject(({ store }) => {
  return {
    store,
    needsDataFetch: store.needsDataFetch,
    projectFetch: store.projectFetch,
    t: store?.t ?? ((k) => k),
  };
});

export const RefreshButton = injector(({ store, needsDataFetch, projectFetch, size, style, t, ...rest }) => {
  const _t = t ?? ((k) => k);
  return (
    <Button
      size={size ?? "small"}
      look={needsDataFetch ? "filled" : "outlined"}
      variant={needsDataFetch ? "primary" : "neutral"}
      waiting={projectFetch}
      aria-label={_t("dataManager.refreshData")}
      onClick={async () => {
        await store.fetchProject({ force: true, interaction: "refresh" });
        await store.currentView?.reload();
      }}
    >
      <IconRefresh />
    </Button>
  );
});
