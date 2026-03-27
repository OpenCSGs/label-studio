import { PersonalInfo } from "./PersonalInfo";
import { PersonalAccessToken, PersonalAccessTokenDescription } from "./PersonalAccessToken";
import { MembershipInfo } from "./MembershipInfo";
import { HotkeysManager } from "./Hotkeys";
import type React from "react";
import { PersonalJWTToken } from "./PersonalJWTToken";
import type { AuthTokenSettings } from "../types";
import { ABILITY, type AuthPermissions } from "@humansignal/core/providers/AuthProvider";
import { ff } from "@humansignal/core";

export type SectionType = {
  title: string | React.ReactNode;
  id: string;
  component: React.FC;
  description?: React.FC;
};

type TFunction = (key: string) => string;

export const accountSettingsSections = (
  settings: AuthTokenSettings,
  permissions: AuthPermissions,
  t: TFunction,
): SectionType[] => {
  const canCreateTokens = permissions.can(ABILITY.can_create_tokens);

  return [
    {
      title: t("accountSettings.personalInfo"),
      id: "personal-info",
      component: PersonalInfo,
    },
    {
      title: t("accountSettings.hotkeys"),
      id: "hotkeys",
      component: HotkeysManager,
      description: () => t("accountSettings.hotkeysDescription"),
    },
    // 邮箱偏好菜单已屏蔽
    // {
    //   title: t("accountSettings.emailPreferences"),
    //   id: "email-preferences",
    //   component: EmailPreferences,
    // },
    {
      title: t("accountSettings.membershipInfo"),
      id: "membership-info",
      component: MembershipInfo,
    },
    settings.api_tokens_enabled &&
      canCreateTokens &&
      ff.isActive(ff.FF_AUTH_TOKENS) && {
        title: t("accountSettings.personalAccessToken"),
        id: "personal-access-token",
        component: PersonalJWTToken,
        description: PersonalAccessTokenDescription,
      },
    settings.legacy_api_tokens_enabled &&
      canCreateTokens && {
        title: ff.isActive(ff.FF_AUTH_TOKENS)
          ? t("accountSettings.legacyToken")
          : t("accountSettings.accessToken"),
        id: "legacy-token",
        component: PersonalAccessToken,
        description: PersonalAccessTokenDescription,
      },
  ].filter(Boolean) as SectionType[];
};
