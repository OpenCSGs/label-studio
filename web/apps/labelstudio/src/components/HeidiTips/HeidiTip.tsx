import { type FC, type MouseEvent, useCallback, useMemo } from "react";
import { Block, Elem } from "../../utils/bem";
import { IconCross } from "@humansignal/icons";
import "./HeidiTip.scss";
import { Button } from "@humansignal/ui";
import { HeidiSpeaking } from "../../assets/images";
import type { HeidiTipProps, Tip } from "./types";
import { createURL } from "./utils";

const HeidiLink: FC<{ link: Tip["link"]; onClick: () => void }> = ({ link, onClick }) => {
  const url = useMemo(() => {
    const params = link.params ?? {};
    /* if needed, add server ID here */

    return createURL(link.url, params);
  }, [link]);

  return (
    /* @ts-ignore-next-line */
    <Elem name="link" tag="a" href={url} target="_blank" onClick={onClick}>
      {link.label}
    </Elem>
  );
};

export const HeidiTip: FC<HeidiTipProps> = ({ tip, onDismiss, onLinkClick }) => {
  const handleClick = useCallback((event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onDismiss();
  }, []);

  return (
    <Block name="heidy-tip">
      <Elem name="content">
        <Elem name="header">
          <Elem name="title">{tip.title}</Elem>
          {tip.closable && (
            <Button tooltip="Don't show" look="string" size="small" onClick={handleClick} className="!p-0">
              <IconCross />
            </Button>
          )}
        </Elem>
        <Elem name="text">
          {tip.content}
          <HeidiLink link={tip.link} onClick={onLinkClick} />
        </Elem>
      </Elem>
      <Elem name="heidi">
        <HeidiSpeaking />
      </Elem>
    </Block>
  );
};
