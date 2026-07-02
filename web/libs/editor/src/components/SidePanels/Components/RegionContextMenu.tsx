import { useCopyText } from "@humansignal/core";
import { IconEllipsis, IconLink } from "@humansignal/icons";
import { Button, ToastType, useToast } from "@humansignal/ui";
import { observer } from "mobx-react";
import { type FC, useCallback, useMemo, useState } from "react";
import { cn } from "../../../utils/bem";
import { useEditorT } from "../../../utils/i18n";
import { ContextMenu, type ContextMenuAction, ContextMenuTrigger, type MenuActionOnClick } from "../../ContextMenu";

export const RegionContextMenu: FC<{ item: any }> = observer(({ item }: { item: any }) => {
  const t = useEditorT();
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
  const [copyLink] = useCopyText({ defaultText: regionLink });
  const toast = useToast();

  const onCopyLink = useCallback<MenuActionOnClick>(
    (_, ctx) => {
      copyLink();
      ctx.dropdown?.close();
      toast.show({
        message: t("annotation.regionLinkCopiedToClipboard"),
        type: ToastType.info,
      });
    },
    [copyLink, t],
  );

  const actions = useMemo<ContextMenuAction[]>(
    () => [
      {
        label: t("annotation.copyRegionLink"),
        onClick: onCopyLink,
        icon: <IconLink />,
      },
    ],
    [onCopyLink, t],
  );

  return (
    <ContextMenuTrigger
      className={cn("region-context-menu").mod({ open }).toClassName()}
      content={<ContextMenu actions={actions} />}
      onToggle={(isOpen) => setOpen(isOpen)}
    >
      <Button variant="neutral" look="string" size="smaller" aria-label={t("annotation.regionOptions")}>
        <IconEllipsis />
      </Button>
    </ContextMenuTrigger>
  );
});
