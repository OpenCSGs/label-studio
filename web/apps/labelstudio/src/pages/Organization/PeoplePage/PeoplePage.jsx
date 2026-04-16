import { Button } from "@humansignal/ui";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useUpdatePageTitle } from "@humansignal/core";
import { HeidiTips } from "../../../components/HeidiTips/HeidiTips";
import { modal } from "../../../components/Modal/Modal";
import { Space } from "../../../components/Space/Space";
import { cn } from "../../../utils/bem";
import { FF_AUTH_TOKENS, FF_LSDV_E_297, isFF } from "../../../utils/feature-flags";
import { PeopleList } from "./PeopleList";
import "./PeoplePage.scss";
import { TokenSettingsModal } from "@humansignal/app-common/blocks/TokenSettingsModal";
import { useToast } from "@humansignal/ui";
import { SelectedUser } from "./SelectedUser";

export const PeoplePage = () => {
  const { t } = useTranslation();
  const apiSettingsModal = useRef();
  const toast = useToast();
  const [selectedUser, setSelectedUser] = useState(null);

  useUpdatePageTitle(t("organization.people"));

  const selectUser = useCallback(
    (user) => {
      setSelectedUser(user);

      localStorage.setItem("selectedUser", user?.id);
    },
    [setSelectedUser],
  );

  const apiTokensSettingsModalProps = useMemo(
    () => ({
      title: t("organization.apiTokensSettings"),
      style: { width: 480 },
      body: () => (
        <TokenSettingsModal
          onSaved={() => {
            toast.show({ message: t("organization.apiTokenSettingsSaved") });
            apiSettingsModal.current?.close();
          }}
        />
      ),
    }),
    [t, toast],
  );

  const showApiTokenSettingsModal = useCallback(() => {
    apiSettingsModal.current = modal(apiTokensSettingsModalProps);
    __lsa("organization.token_settings");
  }, [apiTokensSettingsModalProps]);

  const defaultSelected = useMemo(() => {
    return localStorage.getItem("selectedUser");
  }, []);

  return (
    <div className={cn("people").toClassName()}>
      {isFF(FF_AUTH_TOKENS) && (
        <div className={cn("people").elem("controls").toClassName()}>
          <Space spread>
            <Space />

            <Space>
              <Button look="outlined" onClick={showApiTokenSettingsModal} aria-label={t("organization.showApiTokenSettings")}>
                {t("organization.apiTokensSettings")}
              </Button>
            </Space>
          </Space>
        </div>
      )}
      <div className={cn("people").elem("content").toClassName()}>
        <PeopleList
          selectedUser={selectedUser}
          defaultSelected={defaultSelected}
          onSelect={(user) => selectUser(user)}
        />

        {selectedUser ? (
          <SelectedUser user={selectedUser} onClose={() => selectUser(null)} />
        ) : (
          isFF(FF_LSDV_E_297) && <HeidiTips collection="organizationPage" />
        )}
      </div>
    </div>
  );
};

PeoplePage.titleKey = "organization.people";
PeoplePage.path = "/";
