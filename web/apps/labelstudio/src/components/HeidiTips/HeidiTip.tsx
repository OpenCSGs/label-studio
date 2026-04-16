import { type FC, type MouseEvent, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../utils/bem";
import { IconCross } from "@humansignal/icons";
import "./HeidiTip.scss";
import { Button } from "@humansignal/ui";
import { HeidiSpeaking } from "../../assets/images";
import type { HeidiTipProps, Tip } from "./types";
import { createURL } from "./utils";
import { translateHeidiTip } from "./translateHeidiTip";

const HeidiLink: FC<{ link: Tip["link"]; linkLabel: string; onClick: () => void }> = ({ link, linkLabel, onClick }) => {
  const url = useMemo(() => {
    const params = link.params ?? {};
    /* if needed, add server ID here */

    return createURL(link.url, params);
  }, [link]);

  return (
    <a
      className={cn("heidy-tip").elem("link").toClassName()}
      href={url}
      target="_blank"
      onClick={onClick}
      rel="noreferrer"
    >
      {linkLabel}
    </a>
  );
};

export const HeidiTip: FC<HeidiTipProps> = ({ collection, tip, onDismiss, onLinkClick }) => {
  const { t } = useTranslation();
  const { title, body, linkLabel } = useMemo(
    () => translateHeidiTip(t, collection, tip),
    [t, collection, tip],
  );
  const dismissTooltip = t("heidiTips.dismissTooltip", { defaultValue: "Don't show" });

  const handleClick = useCallback((event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onDismiss();
  }, [onDismiss]);

  return (
    <div className={cn("heidy-tip").toClassName()}>
      <div className={cn("heidy-tip").elem("content").toClassName()}>
        <div className={cn("heidy-tip").elem("header").toClassName()}>
          <div className={cn("heidy-tip").elem("title").toClassName()}>{title}</div>
          {tip.closable && (
            <Button tooltip={dismissTooltip} look="string" size="small" onClick={handleClick} className="!p-0">
              <IconCross />
            </Button>
          )}
        </div>
        <div className={cn("heidy-tip").elem("text").toClassName()}>
          {body}
          <HeidiLink link={tip.link} linkLabel={linkLabel} onClick={onLinkClick} />
        </div>
      </div>
      <div className={cn("heidy-tip").elem("heidi").toClassName()}>
        <HeidiSpeaking />
      </div>
    </div>
  );
};
