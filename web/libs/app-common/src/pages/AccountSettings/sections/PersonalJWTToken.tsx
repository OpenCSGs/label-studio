import { useTranslation } from "react-i18next";
import { Callout, CalloutContent, CalloutHeader, CalloutIcon, CalloutTitle } from "@humansignal/ui/lib/callout/callout";
import { IconWarning } from "@humansignal/icons";
import { atomWithMutation, atomWithQuery, queryClientAtom } from "jotai-tanstack-query";
import { useAtomValue } from "jotai";
import clsx from "clsx";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { useCopyText } from "@humansignal/core";
import styles from "./PersonalJWTToken.module.scss";
import { Button } from "@humansignal/ui";

/**
 * FIXME: This is legacy imports. We're not supposed to use such statements
 * each one of these eventually has to be migrated to core/ui
 */
import { getApiInstance } from "@humansignal/core";
import { modal, confirm } from "@humansignal/ui/lib/modal";
import { Input, Label } from "apps/labelstudio/src/components/Form/Elements";
import { Tooltip } from "@humansignal/ui";

type Token = {
  token: string;
  expires_at: string;
};

const ACCESS_TOKENS_QUERY_KEY = ["access-tokens"];

// list all existing API tokens
const tokensListAtom = atomWithQuery(() => ({
  queryKey: ACCESS_TOKENS_QUERY_KEY,
  async queryFn() {
    const api = getApiInstance();
    const tokens = await api.invoke("accessTokenList");
    if (!tokens.$meta.ok) {
      console.error(token.error);
      return [];
    }

    return tokens as Token[];
  },
}));

// despite the name, gets user's access token
const refreshTokenAtom = atomWithMutation((get) => {
  const queryClient = get(queryClientAtom);
  return {
    mutationKey: ["refresh-token"],
    async mutationFn() {
      const api = getApiInstance();
      const token = await api.invoke("accessTokenGetRefreshToken");
      if (!token.$meta.ok) {
        console.error(token.error);
        return "";
      }
      return token.token;
    },
    onSettled() {
      queryClient.invalidateQueries({ queryKey: ACCESS_TOKENS_QUERY_KEY });
    },
  };
});

const revokeTokenAtom = atomWithMutation((get) => {
  const queryClient = get(queryClientAtom);
  return {
    mutationKey: ["revoke"],
    async mutationFn({ token }: { token: string }) {
      const api = getApiInstance();
      await api.invoke("accessTokenRevoke", null, {
        params: {},
        body: {
          refresh: token,
        },
      });
    },
    // Optimistic update
    async onMutate({ token }: { token: string }) {
      // Cancel all ongoing queries so we can override the data they hold
      await queryClient.cancelQueries({ queryKey: ACCESS_TOKENS_QUERY_KEY });
      // Getting currently cached data of a specific query
      const previousTokens = queryClient.getQueryData(ACCESS_TOKENS_QUERY_KEY) as Token[];
      // We need to keep everything but one token that we just deleted
      const filtered = previousTokens.filter((t) => t.token !== token);
      // We now optimistically override data inside the query
      queryClient.setQueryData(ACCESS_TOKENS_QUERY_KEY, (old: Token[]) => filtered as Token[]);
      return { previousTokens };
    },
    onError: (err, newTodo, context) => {
      // If error, reset query to its previous state (without changes from `onMutate`)
      queryClient.setQueryData(ACCESS_TOKENS_QUERY_KEY, context?.previousTokens);
    },
    onSettled() {
      // Reload query from remote if deletion went ok
      queryClient.invalidateQueries({
        queryKey: ACCESS_TOKENS_QUERY_KEY,
      });
    },
  };
});

export function PersonalJWTToken() {
  const { t } = useTranslation();
  const [dialogOpened, setDialogOpened] = useState(false);
  const tokens = useAtomValue(tokensListAtom);
  const revokeToken = useAtomValue(revokeTokenAtom);
  const createToken = useAtomValue(refreshTokenAtom);
  const queryClient = useAtomValue(queryClientAtom);

  const tokensListClassName = clsx({
    [styles.tokensList]: tokens.data && tokens.data.length,
  });

  const revoke = useCallback(
    async (token: string) => {
      confirm({
        title: t("accountSettings.personalAccessTokenDesc.revokeTokenTitle"),
        body: t("accountSettings.personalAccessTokenDesc.revokeTokenConfirm", {
          appName: window?.APP_SETTINGS?.app_name || "Label Studio",
        }),
        okText: t("accountSettings.personalAccessTokenDesc.revokeToken"),
        buttonLook: "negative",
        onOk: async () => {
          await revokeToken.mutateAsync({ token });
        },
      });
    },
    [revokeToken, t],
  );

  const disallowAddingTokens = useMemo(() => {
    return createToken.isPending || tokens.isLoading || (tokens.data?.length ?? 0) > 0;
  }, [createToken.isPending, tokens.isLoading, tokens.data]);

  function openDialog() {
    if (dialogOpened) return;
    setDialogOpened(true);
    modal({
      visible: true,
      title: t("accountSettings.personalAccessTokenDesc.newAuthToken"),
      style: { width: 680 },
      body: CreateTokenForm,
      closeOnClickOutside: false,
      onHidden: () => {
        setDialogOpened(false);
        queryClient.invalidateQueries({ queryKey: ACCESS_TOKENS_QUERY_KEY });
      },
    });
  }

  return (
    <div className={styles.personalAccessToken}>
      <div className={tokensListClassName}>
        {tokens.isLoading ? (
          <div>{t("accountSettings.personalAccessTokenDesc.loading")}</div>
        ) : tokens.isSuccess && tokens.data && tokens.data.length ? (
          <div>
            <Label text={t("accountSettings.personalAccessTokenDesc.accessToken")} className={styles.label} />
            <div className="flex flex-col gap-2">
              {tokens.data.map((token, index) => {
                return (
                  <div key={`${token.expires_at}${index}`} className={styles.token}>
                    <div className={styles.tokenWrapper}>
                      <div className={styles.expirationDate}>
                        {token.expires_at
                          ? t("accountSettings.personalAccessTokenDesc.expiresOn", {
                              date: format(new Date(token.expires_at), "MMM dd, yyyy HH:mm"),
                            })
                          : t("accountSettings.personalAccessTokenDesc.personalAccessToken")}
                      </div>
                      <div className={styles.tokenString}>{token.token}</div>
                    </div>
                    <Button variant="negative" look="outlined" onClick={() => revoke(token.token)}>
                      {t("accountSettings.personalAccessTokenDesc.revokeToken")}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : tokens.isError ? (
          <div>{t("accountSettings.personalAccessTokenDesc.unableToLoadTokens")}</div>
        ) : null}
      </div>
      <Tooltip title={t("accountSettings.personalAccessTokenDesc.oneActiveTokenTooltip")} disabled={!disallowAddingTokens}>
        <div style={{ width: "max-content" }}>
          <Button disabled={disallowAddingTokens || dialogOpened} onClick={openDialog}>
            {t("accountSettings.personalAccessTokenDesc.createNewToken")}
          </Button>
        </div>
      </Tooltip>
    </div>
  );
}

function CreateTokenForm() {
  const { t } = useTranslation();
  const { data, mutate: createToken } = useAtomValue(refreshTokenAtom);
  const [copy, copied] = useCopyText({ defaultText: typeof data === "string" ? data : "" });

  useEffect(() => {
    createToken();
  }, []);

  const tokenValue = typeof data === "string" ? data : "";

  return (
    <div className="flex flex-col gap-2">
      <p>{t("accountSettings.personalAccessTokenDesc.copyTokenHint")}</p>

      <div className="flex items-end w-full gap-2">
        <Input
          label={t("accountSettings.personalAccessTokenDesc.accessToken")}
          labelProps={{ className: "flex-1", rawClassName: "flex-1" }}
          className="w-full"
          readOnly
          value={tokenValue}
        />
        <Button onClick={() => copy()} disabled={copied} variant="neutral" look="outlined">
          {copied ? t("accountSettings.personalAccessTokenDesc.copied") : t("accountSettings.personalAccessTokenDesc.copy")}
        </Button>
      </div>

      {typeof data === "object" && data?.expires_at && (
        <div>
          <Label text={t("accountSettings.personalAccessTokenDesc.tokenExpiryDate")} />
          {format(new Date(data.expires_at), "MMM dd, yyyy HH:mm z")}
        </div>
      )}

      <Callout variant="warning">
        <CalloutHeader>
          <CalloutIcon>
            <IconWarning />
          </CalloutIcon>
          <CalloutTitle>{t("accountSettings.personalAccessTokenDesc.manageTokensSecurely")}</CalloutTitle>
        </CalloutHeader>
        <CalloutContent>{t("accountSettings.personalAccessTokenDesc.doNotShareKey")}</CalloutContent>
      </Callout>
    </div>
  );
}
