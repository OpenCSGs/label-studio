import { observer } from "mobx-react";
import { useCallback, useMemo, useState, type FC } from "react";
import { useCopyText } from "@humansignal/core/lib/hooks/useCopyText";
import { IconLink, IconEllipsis } from "@humansignal/icons";
import { Button, ToastType, useToast } from "@humansignal/ui";
import { ContextMenu, type ContextMenuAction, ContextMenuTrigger, type MenuActionOnClick } from "../../ContextMenu";
import { cn } from "../../../utils/bem";

export const RegionContextMenu: FC<{ item: any }> = observer(({ item }: { item: any }) => {
  const [open, setOpen] = useState(false);
  const regionLink = useMemo(() => {
    const url = new URL(window.location.href);
    if (item.annotation.pk) {
      url.searchParams.set("annotation", item.annotation.pk);
    }
    if (item.id) {
      url.searchParams.set("region", item.id.split("#")[0]);
    }
    return url.toString();
  }, [item]);
  const [copyLink] = useCopyText(regionLink);
  const toast = useToast();

  const onCopyLink = useCallback<MenuActionOnClick>(
    (_, ctx) => {
      copyLink();
      ctx.dropdown?.close();
      toast.show({
        message: "Region link copied to clipboard",
        type: ToastType.info,
      });
    },
    [copyLink],
  );

  const actions = useMemo<ContextMenuAction[]>(
    () => [
      {
        label: "Copy Region Link",
        onClick: onCopyLink,
        icon: <IconLink />,
      },
    ],
    [onCopyLink],
  );

  return (
    <ContextMenuTrigger
      className={cn("region-context-menu").toClassName()}
      content={<ContextMenu actions={actions} />}
      onToggle={(isOpen) => setOpen(isOpen)}
    >
      <Button
        look="string"
        size="smaller"
        style={{ ...(open ? { display: "flex !important" } : null) }}
        aria-label="Region options"
      >
        <IconEllipsis />
      </Button>
    </ContextMenuTrigger>
  );
});
