import { useEffect, useRef, useState } from "react";
import { useHistory } from "react-router";
import { Button, ToastType, useToast } from "@humansignal/ui";
import { useTranslation } from "react-i18next";
import { Form, Input } from "../../components/Form";
import { Modal } from "../../components/Modal/Modal";
import { Space } from "../../components/Space/Space";
import { useAPI } from "../../providers/ApiProvider";
import { useFixedLocation, useParams } from "../../providers/RoutesProvider";
import { cn } from "../../utils/bem";
import { isDefined } from "../../utils/helpers";
import "./ExportPage.scss";

// const formats = {
//   json: 'JSON',
//   csv: 'CSV',
// };

const downloadFile = (blob, filename) => {
  const link = document.createElement("a");

  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
};

const wait = () => new Promise((resolve) => setTimeout(resolve, 5000));

/** Normalize format name to translation key (e.g. "JSON-MIN" -> "json_min") */
const formatNameToKey = (name) =>
  (name || "")
    .toLowerCase()
    .replace(/-/g, "_")
    .replace(/\s+/g, "_");

/** Get translated format title/description, fallback to API value */
const getTranslatedFormat = (t, format, field) => {
  const key = formatNameToKey(format.name);
  const tKey = `export.formats.${key}.${field}`;
  const translated = t(tKey);
  return translated !== tKey ? translated : format[field];
};

/** Get translated tag, fallback to original */
const getTranslatedTag = (t, tag) => {
  const key = (tag || "").toLowerCase().replace(/\s+/g, "");
  const tKey = `export.formats.tags.${key}`;
  const translated = t(tKey);
  return translated !== tKey ? translated : tag;
};

export const ExportPage = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const location = useFixedLocation();
  const pageParams = useParams();
  const api = useAPI();
  const toast = useToast();

  const [previousExports, setPreviousExports] = useState([]);
  const [downloading, setDownloading] = useState(false);
  const [downloadingMessage, setDownloadingMessage] = useState(false);
  const [availableFormats, setAvailableFormats] = useState([]);
  const [currentFormat, setCurrentFormat] = useState("JSON");

  /** @type {import('react').RefObject<Form>} */
  const form = useRef();

  const proceedExport = async () => {
    setDownloading(true);

    const message = setTimeout(() => {
      setDownloadingMessage(true);
    }, 1000);

    try {
      const params = form.current.assembleFormData({
        asJSON: true,
        full: true,
        booleansAsNumbers: true,
      });

      const response = await api.callApi("exportRaw", {
        params: {
          pk: pageParams.id,
          ...params,
        },
      });

      if (response.ok) {
        const contentType = response.headers.get("content-type") || "";
        // 导出到 CSGHub：后端返回 JSON，不触发本地下载
        if (contentType.includes("application/json")) {
          const data = await response.json().catch(() => ({}));
          if (data.exported_to_csghub) {
            toast?.show({
              message: t("export.exportCompletedSuccessfully"),
              type: ToastType.info,
            });
            const path = location.pathname.replace(ExportPage.path, "");
            const search = location.search;
            history.replace(`${path}${search !== "?" ? search : ""}`);
            return;
          }
        }
        // 否则为文件流，下载到本地
        const blob = await response.blob();
        downloadFile(blob, response.headers.get("filename"));
      } else {
        api.handleError(response);
      }
    } finally {
      setDownloading(false);
      setDownloadingMessage(false);
      clearTimeout(message);
    }
  };

  useEffect(() => {
    if (isDefined(pageParams.id)) {
      api
        .callApi("previousExports", {
          params: {
            pk: pageParams.id,
          },
        })
        .then(({ export_files }) => {
          setPreviousExports(export_files.slice(0, 1));
        });

      api
        .callApi("exportFormats", {
          params: {
            pk: pageParams.id,
          },
        })
        .then((formats) => {
          setAvailableFormats(formats);
          setCurrentFormat(formats[0]?.name);
        });
    }
  }, [pageParams]);

  return (
    <Modal
      onHide={() => {
        const path = location.pathname.replace(ExportPage.path, "");
        const search = location.search;

        history.replace(`${path}${search !== "?" ? search : ""}`);
      }}
      title={t("export.exportData")}
      style={{ width: 720 }}
      closeOnClickOutside={false}
      allowClose={!downloading}
      // footer="Read more about supported export formats in the Documentation."
      visible
    >
      <div className={cn("export-page").toClassName()}>
        <FormatInfo
          t={t}
          availableFormats={availableFormats}
          selected={currentFormat}
          onClick={(format) => setCurrentFormat(format.name)}
        />

        <Form ref={form}>
          <Input type="hidden" name="exportType" value={currentFormat} />
        </Form>

        <div className={cn("export-page").elem("footer").toClassName()}>
          <Space style={{ width: "100%" }} spread>
            <div className={cn("export-page").elem("recent").toClassName()}>{/* {exportHistory} */}</div>
            <div className={cn("export-page").elem("actions").toClassName()}>
              <Space>
                {downloadingMessage && t("export.filesBeingPrepared")}
                <Button className="w-[135px]" onClick={proceedExport} waiting={downloading} aria-label={t("export.exportData")}>
                  {t("export.export")}
                </Button>
              </Space>
            </div>
          </Space>
        </div>
      </div>
    </Modal>
  );
};

const FormatInfo = ({ t, availableFormats, selected, onClick }) => {
  return (
    <div className={cn("formats").toClassName()}>
      <div className={cn("formats").elem("info").toClassName()}>
        {t("export.exportDatasetFormats")}
      </div>
      <div className={cn("formats").elem("list").toClassName()}>
        {availableFormats.map((format) => (
          <div
            key={format.name}
            className={cn("formats")
              .elem("item")
              .mod({
                active: !format.disabled,
                selected: format.name === selected,
              })
              .toClassName()}
            onClick={!format.disabled ? () => onClick(format) : null}
          >
            <div className={cn("formats").elem("name").toClassName()}>
              {getTranslatedFormat(t, format, "title")}

              <Space size="small">
                {format.tags?.map?.((tag, index) => (
                  <div key={index} className={cn("formats").elem("tag").toClassName()}>
                    {getTranslatedTag(t, tag)}
                  </div>
                ))}
              </Space>
            </div>

            {format.description && (
              <div className={cn("formats").elem("description").toClassName()}>
                {getTranslatedFormat(t, format, "description")}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className={cn("formats").elem("feedback").toClassName()}>
        {t("export.cantFindFormat")}
        <br />
        {t("export.pleaseLetUsKnow")}{" "}
        <a className="no-go" href="https://slack.labelstud.io/?source=product-export" target="_blank" rel="noreferrer">
          {t("export.slack")}
        </a>{" "}
        {t("export.orSubmitIssue")}{" "}
        <a
          className="no-go"
          href="https://github.com/HumanSignal/label-studio-converter/issues"
          target="_blank"
          rel="noreferrer"
        >
          {t("export.repository")}
        </a>
      </div>
    </div>
  );
};

ExportPage.path = "/export";
ExportPage.modal = true;
