import { Block } from "apps/labelstudio/src/components/Menu/MenuContext";
import { Input } from "../../../components/Form";
import { useCallback, useEffect, useRef, useState } from "react";
import { Space } from "@humansignal/ui/lib/space/space";
import { API } from "apps/labelstudio/src/providers/ApiProvider";
import { atomWithQuery } from "jotai-tanstack-query";
import { useAtomValue } from "jotai";
import { Modal } from "apps/labelstudio/src/components/Modal/ModalPopup";
import { Button, Typography } from "@humansignal/ui";
import { useTranslation } from "react-i18next";

const linkAtom = atomWithQuery(() => ({
  queryKey: ["invite-link"],
  async queryFn() {
    // called only once when the component is rendered on page reload
    // will also be reset when called `refetch()` on the Reset button
    const result = await API.invoke("resetInviteLink");
    return location.origin + result.invite_url;
  },
}));

export function InviteLink({
  opened,
  onOpened,
  onClosed,
}: {
  opened: boolean;
  onOpened?: () => void;
  onClosed?: () => void;
}) {
  const { t } = useTranslation();
  const modalRef = useRef<Modal>();
  useEffect(() => {
    if (modalRef.current && opened) {
      modalRef.current?.show?.();
    } else if (modalRef.current && modalRef.current.visible) {
      modalRef.current?.hide?.();
    }
  }, [opened]);

  return (
    <Modal
      ref={modalRef}
      title={t("organization.invitePeople")}
      opened={opened}
      bareFooter={true}
      body={<InvitationModal />}
      footer={<InvitationFooter />}
      style={{ width: 640, height: 472 }}
      onHide={onClosed}
      onShow={onOpened}
    />
  );
}

const InvitationModal = () => {
  const { t } = useTranslation();
  const { data: link } = useAtomValue(linkAtom);
  return (
    <Block name="invite">
      <Input value={link} style={{ width: "100%" }} readOnly />
      <Typography size="small" className="text-neutral-content-subtler mt-base mb-wider">
        {t("organization.invitePeopleDescription")}{" "}
        <a
          href="https://labelstud.io/guide/signup.html"
          target="_blank"
          rel="noreferrer"
          className="hover:underline"
          onClick={() =>
            __lsa("docs.organization.add_people.learn_more", { href: "https://labelstud.io/guide/signup.html" })
          }
        >
          {t("organization.learnMore")}
        </a>
        .
      </Typography>
    </Block>
  );
};

const InvitationFooter = () => {
  const { t } = useTranslation();
  const { copyText, copied } = useTextCopy();
  const { refetch, data: link } = useAtomValue(linkAtom);

  return (
    <Space spread>
      <Space>
        <Button look="outlined" style={{ width: 170 }} onClick={() => refetch()} aria-label={t("organization.refreshInviteLink")}>
          {t("organization.resetLink")}
        </Button>
      </Space>
      <Space>
        <Button
          variant={copied ? "positive" : "primary"}
          className="w-[170px]"
          onClick={() => copyText(link!)}
          aria-label={t("organization.copyInviteLink")}
        >
          {copied ? t("organization.copied") : t("organization.copyLink")}
        </Button>
      </Space>
    </Space>
  );
};

function useTextCopy() {
  const [copied, setCopied] = useState(false);

  const copyText = useCallback((value: string) => {
    setCopied(true);
    navigator.clipboard.writeText(value ?? "");
    setTimeout(() => setCopied(false), 1500);
  }, []);

  return { copied, copyText };
}
