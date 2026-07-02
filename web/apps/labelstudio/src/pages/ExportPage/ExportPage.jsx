import { useEffect, useRef, useState } from "react";
import { useHistory } from "react-router";
import { Button, ToastType, useToast } from "@humansignal/ui";
import { useTranslation } from "react-i18next";
import { Form, Input, Select } from "../../components/Form";
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

  // CSGHub 数据集和分支选择
  const [datasets, setDatasets] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [loadingDatasets, setLoadingDatasets] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [project, setProject] = useState(null);

  /** @type {import('react').RefObject<Form>} */
  const form = useRef();

  const proceedExport = async () => {
    // 检查是否选择了数据集和分支
    if (!selectedDataset || !selectedBranch) {
      toast?.show({
        message: t("export.pleaseSelectDatasetAndBranch"),
        type: ToastType.warning,
      });
      return;
    }

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

      // 添加目标数据集和分支参数
      params.target_dataset = selectedDataset;
      params.target_branch = selectedBranch;

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
      // 获取项目信息
      api
        .callApi("project", {
          params: {
            pk: pageParams.id,
          },
        })
        .then((projectData) => {
          setProject(projectData);

          // 如果项目绑定了个人数据集（不是组织数据集），设置为默认值
          if (projectData.dataset && projectData.datasetBranches) {
            const dataset = projectData.dataset;
            // 检查是否为个人数据集：通过判断 dataset 是否在个人数据集列表中
            // 先加载个人数据集列表，然后在回调中设置默认值
            loadPersonalDatasetsWithDefault(dataset, projectData.datasetBranches);
          } else {
            // 没有绑定数据集，直接加载个人数据集列表
            loadPersonalDatasets();
          }
        });

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

  // 加载个人数据集列表
  const loadPersonalDatasets = async () => {
    setLoadingDatasets(true);
    try {
      const data = await api.callApi("publicList");
      const list = Array.isArray(data) ? data : [];
      setDatasets(list.map((item) => ({ value: item, label: item })));

      if (list.length === 0) {
        toast?.show({
          message: t("export.noPersonalDatasets"),
          type: ToastType.warning,
        });
      }
    } catch (err) {
      console.error("Failed to fetch personal datasets:", err);
      setDatasets([]);
      toast?.show({
        message: t("export.failedToLoadDatasets"),
        type: ToastType.error,
      });
    } finally {
      setLoadingDatasets(false);
    }
  };

  // 加载个人数据集列表并设置默认值
  const loadPersonalDatasetsWithDefault = async (defaultDataset, defaultBranch) => {
    setLoadingDatasets(true);
    try {
      const data = await api.callApi("publicList");
      const list = Array.isArray(data) ? data : [];
      setDatasets(list.map((item) => ({ value: item, label: item })));

      // 只有当默认数据集在个人数据集列表中时，才设置为默认值
      if (list.includes(defaultDataset)) {
        setSelectedDataset(defaultDataset);
        setSelectedBranch(defaultBranch);
      }

      if (list.length === 0) {
        toast?.show({
          message: t("export.noPersonalDatasets"),
          type: ToastType.warning,
        });
      }
    } catch (err) {
      console.error("Failed to fetch personal datasets:", err);
      setDatasets([]);
      toast?.show({
        message: t("export.failedToLoadDatasets"),
        type: ToastType.error,
      });
    } finally {
      setLoadingDatasets(false);
    }
  };

  // 加载分支列表
  const loadBranches = async (repoId) => {
    if (!repoId) return;
    setLoadingBranches(true);
    try {
      const data = await api.callApi("datasetBranches", {
        params: { repo_id: repoId },
      });
      const list = Array.isArray(data) ? data : [];
      setBranches(list.map((branch) => ({ value: branch, label: branch })));
    } catch (err) {
      console.error("Failed to fetch branches:", err);
      setBranches([]);
      toast?.show({
        message: t("export.failedToLoadBranches"),
        type: ToastType.error,
      });
    } finally {
      setLoadingBranches(false);
    }
  };

  // 分支改为手动输入：清空数据集时一并清空已输入的分支
  useEffect(() => {
    if (!selectedDataset) {
      setSelectedBranch("");
    }
  }, [selectedDataset]);

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
        {/* CSGHub 数据集和分支选择 */}
        <div className={cn("export-page").elem("csghub-section").toClassName()}>
          <div className={cn("export-page").elem("csghub-title").toClassName()}>
            {t("export.exportToCSGHub")}
          </div>

          <Form ref={form}>
            <div className={cn("export-page").elem("csghub-selectors").toClassName()}>
              <Select
                label={t("export.targetDataset")}
                placeholder={t("export.selectDataset")}
                options={datasets}
                value={selectedDataset}
                onChange={(val) => setSelectedDataset(val)}
                disabled={loadingDatasets || datasets.length === 0}
                style={{ marginBottom: '12px' }}
              />

              <div style={{ marginBottom: '12px' }}>
                <div style={{ marginBottom: '4px' }}>{t("export.targetBranch")}</div>
                <input
                  type="text"
                  className={cn("input-ls").toClassName()}
                  placeholder={t("export.enterBranch")}
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  disabled={!selectedDataset}
                  style={{ width: "100%" }}
                />
              </div>
            </div>

            <Input type="hidden" name="exportType" value={currentFormat} />
          </Form>

          {datasets.length === 0 && !loadingDatasets && (
            <div className={cn("export-page").elem("csghub-warning").toClassName()}>
              {t("export.pleaseCreateDatasetFirst")}
            </div>
          )}
        </div>

        <FormatInfo
          t={t}
          availableFormats={availableFormats}
          selected={currentFormat}
          onClick={(format) => setCurrentFormat(format.name)}
        />

        <div className={cn("export-page").elem("footer").toClassName()}>
          <Space style={{ width: "100%" }} spread>
            <div className={cn("export-page").elem("recent").toClassName()}>{/* {exportHistory} */}</div>
            <div className={cn("export-page").elem("actions").toClassName()}>
              <Space>
                {downloadingMessage && t("export.filesBeingPrepared")}
                <Button
                  className="w-[135px]"
                  onClick={proceedExport}
                  waiting={downloading}
                  disabled={!selectedDataset || !selectedBranch}
                  aria-label={t("export.exportData")}
                >
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
