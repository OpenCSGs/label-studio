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
        
        message.success('Export completed successfully');
      } else {
        api.handleError(response);
        // 显示错误提示
        message.error('export error');
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
          setAvailableFormats(formats);
          setCurrentFormat(formats[0]?.name);
        });
    }
  }, [pageParams]);

  return (
    <>
      <Modal
        onHide={closeModal}
        title="Export data"
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
                  {downloadingMessage && "Files are being prepared. It might take some time."}
                  <Button className="w-[135px]" onClick={proceedExport} waiting={downloading} aria-label="Export data">
                    Export
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
          <Toast.Action className="ToastAction" asChild altText="Close">
            <button className="Button small green">关闭</button>
          </Toast.Action>
        </Toast.Root>
        <Toast.Viewport className="ToastViewport" />
      </Toast.Provider>
    </>
  );
};

const FormatInfo = ({ availableFormats, selected, onClick }) => {
  return (
    <Block name="formats">
      <Elem name="info">You can export dataset in one of the following formats:</Elem>
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
        Can't find an export format?
        <br />
        Please let us know in{" "}
        <a className="no-go" href="https://slack.labelstud.io/?source=product-export" target="_blank" rel="noreferrer">
          Slack
        </a>{" "}
        or submit an issue to the{" "}
        <a
          className="no-go"
          href="https://github.com/HumanSignal/label-studio-converter/issues"
          target="_blank"
          rel="noreferrer"
        >
          Repository
        </a>
      </Elem>
    </Block>
  );
};

ExportPage.path = "/export";
ExportPage.modal = true;