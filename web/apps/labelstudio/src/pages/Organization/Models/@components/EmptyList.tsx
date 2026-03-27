import { Button } from "@humansignal/ui";
import { useTranslation } from "react-i18next";
import { cn } from "apps/labelstudio/src/utils/bem";
import type { FC } from "react";
import "./EmptyList.scss";
import { HeidiAi } from "apps/labelstudio/src/assets/images";

export const EmptyList: FC = () => {
  const { t } = useTranslation();
  return (
    <div className={cn("empty-models-list").toClassName()}>
      <div className={cn("empty-models-list").elem("content").toClassName()}>
        <div className={cn("empty-models-list").elem("heidy").toClassName()}>
          <HeidiAi />
        </div>
        <div className={cn("empty-models-list").elem("title").toClassName()}>{t("models.createModel")}</div>
        <div className={cn("empty-models-list").elem("caption").toClassName()}>
          {t("models.createModelDescription")}
        </div>
        <Button aria-label={t("models.createNewModel")}>{t("models.createModel")}</Button>
      </div>
    </div>
  );
};
