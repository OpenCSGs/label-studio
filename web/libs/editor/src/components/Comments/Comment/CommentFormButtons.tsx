import type { MouseEventHandler } from "react";

import { IconCommentLinkTo, IconSend } from "@humansignal/icons";
import { Tooltip } from "@humansignal/ui";
import { useTranslation } from "react-i18next";
import { Block, Elem } from "../../../utils/bem";
import "./CommentFormButtons.scss";

export const CommentFormButtons = ({
  region,
  linking,
  onLinkTo,
}: { region: any; linking: boolean; onLinkTo?: MouseEventHandler<HTMLElement> }) => {
  const { t } = useTranslation();
  return (
    <Block name="comment-form-buttons">
      <Elem name="buttons">
        {onLinkTo && !region && (
          <Tooltip title="Link to...">
            <Elem name="action" tag="button" mod={{ highlight: linking }} onClick={onLinkTo}>
              <IconCommentLinkTo />
            </Elem>
          </Tooltip>
        )}
        <Elem name="action" tag="button" type="submit" aria-label={t("annotation.add")}>
          <IconSend />
        </Elem>
      </Elem>
    </Block>
  );
};
