import { useEffect, useRef, useState } from "react";
import { useHistory } from "react-router";
import { Button } from "@humansignal/ui";
import { Form, Input } from "../../components/Form";
import { Modal } from "../../components/Modal/Modal";
import { Space } from "../../components/Space/Space";
import { useAPI } from "../../providers/ApiProvider";
import { useFixedLocation, useParams } from "../../providers/RoutesProvider";
import { BemWithSpecifiContext } from "../../utils/bem";
import { isDefined } from "../../utils/helpers";
import * as Toast from "@radix-ui/react-toast";
import "./ExportPage.scss";
import { message } from 'antd';
import { useTranslation } from "react-i18next";

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

const { Block, Elem } = BemWithSpecifiContext();

export const ExportPage = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const location = useFixedLocation();
  const pageParams = useParams();
  const api = useAPI();

  const [previousExports, setPreviousExports] = useState([]);
  const [downloading, setDownloading] = useState(false);
  const [downloadingMessage, setDownloadingMessage] = useState(false);
  const [availableFormats, setAvailableFormats] = useState([]);
  const [currentFormat, setCurrentFormat] = useState("JSON");
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastTitle, setToastTitle] = useState("");

  /** @type {import('react').RefObject<Form>} */
  const form = useRef();

  const closeModal = () => {
    const path = location.pathname.replace(ExportPage.path, "");
    const search = location.search;
    history.replace(`${path}${search !== "?" ? search : ""}`);
  };

  const showToast = (title, message) => {
    setToastTitle(title);
    setToastMessage(message);
    setToastOpen(true);
  };

  const proceedExport = async () => {
    setDownloading(true);

    // const message = setTimeout(() => {
    //   setDownloadingMessage(true);
    // }, 1000);

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

      console.log(response,'responseresponseresponseresponse');
      

      if (response.status == 200) {
        // const blob = await response.blob();
        // downloadFile(blob, response.headers.get("filename"));
        
        // 立即关闭导出弹框
        closeModal();
        
        message.success(t("export.exportCompletedSuccessfully"));
      } else {
        api.handleError(response);
        // 显示错误提示
        message.error(t("export.exportError"));
      }
    } catch (error) {
      console.error("Export failed:", error);
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
          // 国际化格式标题和描述
          const translatedFormats = formats.map((format) => {
            const formatKey = format.name?.toLowerCase() || '';
            const translatedFormat = { ...format };
            
            // 翻译标题 - 如果翻译键存在则使用翻译，否则使用原始值
            const titleKey = `export.formats.${formatKey}.title`;
            const translatedTitle = t(titleKey);
            if (translatedTitle !== titleKey && format.title) {
              translatedFormat.title = translatedTitle;
            }
            
            // 翻译描述 - 如果翻译键存在则使用翻译，否则使用原始值
            const descKey = `export.formats.${formatKey}.description`;
            const translatedDesc = t(descKey);
            if (translatedDesc !== descKey && format.description) {
              translatedFormat.description = translatedDesc;
            }
            
            // 翻译标签 - 标签翻译是共享的，放在 export.formats.tags 下
            if (format.tags && Array.isArray(format.tags)) {
              translatedFormat.tags = format.tags.map((tag) => {
                const tagKey = tag?.toLowerCase()?.replace(/\s+/g, '') || '';
                const tagTranslationKey = `export.formats.tags.${tagKey}`;
                const translatedTag = t(tagTranslationKey);
                // 如果翻译键存在（返回值不等于键本身），则使用翻译，否则使用原始标签
                return translatedTag !== tagTranslationKey ? translatedTag : tag;
              });
            }
            
            return translatedFormat;
          });
          
          setAvailableFormats(translatedFormats);
          setCurrentFormat(translatedFormats[0]?.name);
        });
    }
  }, [pageParams, t]);

  return (
    <>
      <Modal
        onHide={closeModal}
        title={t("export.exportData")}
        style={{ width: 720 }}
        closeOnClickOutside={false}
        allowClose={!downloading}
        visible
      >
        <Block name="export-page">
          <FormatInfo
            availableFormats={availableFormats}
            selected={currentFormat}
            onClick={(format) => setCurrentFormat(format.name)}
          />

          <Form ref={form}>
            <Input type="hidden" name="exportType" value={currentFormat} />
          </Form>

          <Elem name="footer">
            <Space style={{ width: "100%" }} spread>
              <Elem name="recent">{/* {exportHistory} */}</Elem>
              <Elem name="actions">
                <Space>
                  {downloadingMessage && t("export.filesBeingPrepared")}
                  <Button className="w-[135px]" onClick={proceedExport} waiting={downloading} aria-label={t("export.exportData")}>
                    {t("export.export")}
                  </Button>
                </Space>
              </Elem>
            </Space>
          </Elem>
        </Block>
      </Modal>

      {/* Toast 通知 */}
      <Toast.Provider swipeDirection="right">
        <Toast.Root
          className="ToastRoot"
          open={toastOpen}
          onOpenChange={setToastOpen}
          duration={3000}
        >
          <Toast.Title className="ToastTitle">{toastTitle}</Toast.Title>
          <Toast.Description className="ToastDescription">
            {toastMessage}
          </Toast.Description>
          <Toast.Action className="ToastAction" asChild altText={t("export.close")}>
            <button className="Button small green">{t("export.close")}</button>
          </Toast.Action>
        </Toast.Root>
        <Toast.Viewport className="ToastViewport" />
      </Toast.Provider>
    </>
  );
};

const FormatInfo = ({ availableFormats, selected, onClick }) => {
  const { t } = useTranslation();
  return (
    <Block name="formats">
      <Elem name="info">{t("export.exportDatasetFormats")}</Elem>
      <Elem name="list">
        {availableFormats.map((format) => (
          <Elem
            key={format.name}
            name="item"
            mod={{
              active: !format.disabled,
              selected: format.name === selected,
            }}
            onClick={!format.disabled ? () => onClick(format) : null}
          >
            <Elem name="name">
              {format.title}

              <Space size="small">
                {format.tags?.map?.((tag, index) => (
                  <Elem key={index} name="tag">
                    {tag}
                  </Elem>
                ))}
              </Space>
            </Elem>

            {format.description && <Elem name="description">{format.description}</Elem>}
          </Elem>
        ))}
      </Elem>
      <Elem name="feedback">
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
      </Elem>
    </Block>
  );
};

ExportPage.path = "/export";
ExportPage.modal = true;