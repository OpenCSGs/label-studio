import { SampleDatasetSelect } from "@humansignal/app-common/blocks/SampleDatasetSelect/SampleDatasetSelect";
import { ff, formatFileSize } from "@humansignal/core";
import { IconCode, IconErrorAlt, IconFileUpload, IconInfoOutline, IconTrash, IconUpload } from "@humansignal/icons";
import { Badge } from "@humansignal/shad/components/ui/badge";
import { cn as scn } from "@humansignal/shad/utils";
import { useAtomValue } from "jotai";
import Input from "libs/datamanager/src/components/Common/Input/Input";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useAPI } from "../../../providers/ApiProvider";
import { cn } from "../../../utils/bem";
import { unique } from "../../../utils/helpers";
import { sampleDatasetAtom } from "../utils/atoms";
import "./Import.scss";
import { Button, CodeBlock, SimpleCard, Spinner, Tooltip, Typography } from "@humansignal/ui";
import truncate from "truncate-middle";
import { useTranslation } from "react-i18next";
import samples from "./samples.json";
import { importFiles } from "./utils";

const importClass = cn("upload_page");
const dropzoneClass = cn("dropzone");

// Constants for file display and animation
const FLASH_ANIMATION_DURATION = 2000; // 2 seconds
const FILENAME_TRUNCATE_START = 24;
const FILENAME_TRUNCATE_END = 24;

function flatten(nested) {
  return [].concat(...nested);
}

// Keep in sync with core.settings.SUPPORTED_EXTENSIONS on the BE.
const supportedExtensions = {
  text: ["txt"],
  audio: ["wav", "mp3", "flac", "m4a", "ogg"],
  video: ["mp4", "webm"],
  image: ["bmp", "gif", "jpg", "jpeg", "png", "svg", "webp"],
  html: ["html", "htm", "xml"],
  structuredData: ["csv", "tsv", "json"],
};
const allSupportedExtensions = flatten(Object.values(supportedExtensions));

function getFileExtension(fileName) {
  if (!fileName) {
    return fileName;
  }
  return fileName.split(".").pop().toLowerCase();
}

function traverseFileTree(item, path) {
  return new Promise((resolve) => {
    path = path || "";
    if (item.isFile) {
      // Avoid hidden files
      if (item.name[0] === ".") return resolve([]);

      resolve([item]);
    } else if (item.isDirectory) {
      // Get folder contents
      const dirReader = item.createReader();
      const dirPath = `${path + item.name}/`;

      dirReader.readEntries((entries) => {
        Promise.all(entries.map((entry) => traverseFileTree(entry, dirPath)))
          .then(flatten)
          .then(resolve);
      });
    }
  });
}

function getFiles(files) {
  // @todo this can be not a files, but text or any other draggable stuff
  return new Promise((resolve) => {
    if (!files.length) return resolve([]);
    if (!files[0].webkitGetAsEntry) return resolve(files);

    // Use DataTransferItemList interface to access the file(s)
    const entries = Array.from(files).map((file) => file.webkitGetAsEntry());

    Promise.all(entries.map(traverseFileTree))
      .then(flatten)
      .then((fileEntries) => fileEntries.map((fileEntry) => new Promise((res) => fileEntry.file(res))))
      .then((filePromises) => Promise.all(filePromises))
      .then(resolve);
  });
}

const Upload = ({ children, sendFiles, disabled }) => {
  const [hovered, setHovered] = useState(false);
  const onHover = (e) => {
    if (disabled) return;
    e.preventDefault();
    setHovered(true);
  };
  const onLeave = setHovered.bind(null, false);
  const dropzoneRef = useRef();

  const onDrop = useCallback(
    (e) => {
      if (disabled) return;
      e.preventDefault();
      onLeave();
      getFiles(e.dataTransfer.items).then((files) => sendFiles(files));
    },
    [onLeave, sendFiles, disabled],
  );

  return (
    <div
      id="holder"
      className={dropzoneClass.mod({ hovered, disabled })}
      ref={dropzoneRef}
      onDragStart={disabled ? undefined : onHover}
      onDragOver={disabled ? undefined : onHover}
      onDragLeave={onLeave}
      onDrop={disabled ? undefined : onDrop}
      style={disabled ? { pointerEvents: "none", opacity: 0.5 } : {}}
    >
      {children}
    </div>
  );
};

const ErrorMessage = ({ error }) => {
  if (!error) return null;
  let extra = error.validation_errors ?? error.extra;
  // support all possible responses

  if (extra && typeof extra === "object" && !Array.isArray(extra)) {
    extra = extra.non_field_errors ?? Object.values(extra);
  }
  if (Array.isArray(extra)) extra = extra.join("; ");

  return (
    <div className={importClass.elem("error")}>
      <IconErrorAlt width="24" height="24" />
      {error.id && `[${error.id}] `}
      {error.detail || error.message}
      {extra && ` (${extra})`}
    </div>
  );
};

export const ImportPage = ({
  project,
  sample,
  show = true,
  onWaiting,
  onFileListUpdate,
  onSampleDatasetSelect,
  highlightCsvHandling,
  dontCommitToProject = false,
  csvHandling,
  setCsvHandling,
  addColumns,
  openLabelingConfig,
}) => {
  const { t } = useTranslation();
  const [error, setError] = useState();
  const [newlyUploadedFiles, setNewlyUploadedFiles] = useState(new Set());
  const prevUploadedRef = useRef(new Set());
  const api = useAPI();
  const projectConfigured = project?.label_config !== "<View></View>";
  const sampleConfig = useAtomValue(sampleDatasetAtom);

  // 数据集与分支（CSGHub）
  // 数据所有者列表（namespaces）：每项 {path, type}，type=user 为个人、organization 为组织
  const [owners, setOwners] = useState([]);
  const [selectedOwner, setSelectedOwner] = useState("");
  const [datasets, setDatasets] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [loadingOwners, setLoadingOwners] = useState(false);
  const [loadingDatasets, setLoadingDatasets] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [datasetsFetched, setDatasetsFetched] = useState(false);
  const [ownersFetched, setOwnersFetched] = useState(false);
  const isUploadDisabled = !selectedDataset || !selectedBranch;

  const processFiles = (state, action) => {
    if (action.sending) {
      return { ...state, uploading: [...action.sending, ...state.uploading] };
    }
    if (action.sent) {
      return {
        ...state,
        uploading: state.uploading.filter((f) => !action.sent.includes(f)),
      };
    }
    if (action.uploaded) {
      return {
        ...state,
        uploaded: unique([...state.uploaded, ...action.uploaded], (a, b) => a.id === b.id),
      };
    }
    if (action.ids) {
      const ids = unique([...state.ids, ...action.ids]);

      onFileListUpdate?.(ids);
      return { ...state, ids };
    }
    return state;
  };

  const [files, dispatch] = useReducer(processFiles, {
    uploaded: [],
    uploading: [],
    ids: [],
  });
  const showList = Boolean(files.uploaded?.length || files.uploading?.length || sample);

  const loadFilesList = useCallback(
    async (file_upload_ids) => {
      const query = {};

      if (file_upload_ids) {
        // should be stringified array "[1,2]"
        query.ids = JSON.stringify(file_upload_ids);
      }
      const files = await api.callApi("fileUploads", {
        params: { pk: project.id, ...query },
      });

      dispatch({ uploaded: files ?? [] });

      if (files?.length) {
        dispatch({ ids: files.map((f) => f.id) });
      }
      return files;
    },
    [project?.id],
  );

  const onError = (err) => {
    console.error(err);
    // 兼容 string / 数组(DRF ValidationError) / 对象三种后端返回结构，提取错误文本
    const errText =
      typeof err === "string"
        ? err
        : Array.isArray(err)
          ? err.join(" ")
          : err?.detail || err?.message || "";
    if (errText.includes("RequestDataTooBig")) {
      const message = t("settings.importedFileTooBig");
      const extra = errText.match(/"exception_value">(.*)<\/pre>/)?.[1];
      err = { message, extra };
    } else if (errText.includes("NoSupportedFilesToAnnotate")) {
      // CSGHub 数据集导入时所有文件都因不受支持被跳过
      err = { message: t("createProject.noFilesToAnnotate") };
    }
    setError(err);
    onWaiting?.(false);
  };
  const onFinish = useCallback(
    async (res) => {
      const { could_be_tasks_list, data_columns, file_upload_ids } = res;

      dispatch({ ids: file_upload_ids });
      if (could_be_tasks_list && !csvHandling) setCsvHandling("choose");
      onWaiting?.(false);
      addColumns(data_columns);

      await loadFilesList(file_upload_ids);
      return res;
    },
    [addColumns, loadFilesList],
  );

  // Track newly uploaded files for flash animation
  useEffect(() => {
    const currentUploadedIds = new Set(files.uploaded.map((f) => f.id));
    const previousUploadedIds = prevUploadedRef.current;

    // Find files that were just uploaded (in current but not in previous)
    const justUploaded = new Set([...currentUploadedIds].filter((id) => !previousUploadedIds.has(id)));

    // Update the ref immediately after comparison to ensure it's available for next run
    prevUploadedRef.current = new Set(currentUploadedIds);

    // Clean up animation state for files that are no longer in the uploaded list
    setNewlyUploadedFiles((prev) => {
      const filtered = new Set([...prev].filter((id) => currentUploadedIds.has(id)));
      return filtered;
    });

    // Animate newly uploaded files (including first upload)
    if (justUploaded.size > 0) {
      // Apply animation class immediately for better responsiveness
      setNewlyUploadedFiles((prev) => new Set([...prev, ...justUploaded]));

      // Remove animation class after animation completes (CSS handles the animation timing)
      const timeoutId = setTimeout(() => {
        setNewlyUploadedFiles((prev) => {
          const updated = new Set(prev);
          justUploaded.forEach((id) => updated.delete(id));
          return updated;
        });
      }, FLASH_ANIMATION_DURATION);

      // Cleanup timeout on unmount or dependency change
      return () => clearTimeout(timeoutId);
    }
  }, [files.uploaded]);

  const importFilesImmediately = useCallback(
    async (files, body) => {
      importFiles({
        files,
        body,
        project,
        onError,
        onFinish,
        onUploadStart: (files) => dispatch({ sending: files }),
        onUploadFinish: (files) => dispatch({ sent: files }),
        dontCommitToProject,
      });
    },
    [project, onFinish],
  );

  const sendFiles = useCallback(
    (files) => {
      if (!selectedDataset || !selectedBranch) {
        setError(new Error(t("createProject.pleaseSelectBothDatasetAndBranch")));
        return;
      }
      setError(null);
      onWaiting?.(true);
      files = [...files];
      const fd = new FormData();
      fd.append("dataset", selectedDataset);
      fd.append("datasetBranches", selectedBranch);
      for (const f of files) {
        if (!allSupportedExtensions.includes(getFileExtension(f.name))) {
          onError(new Error(t("createProject.unsupportedFileType", { name: f.name })));
          return;
        }
        fd.append(f.name, f);
      }
      return importFilesImmediately(files, fd);
    },
    [importFilesImmediately, selectedDataset, selectedBranch, t],
  );

  const onUpload = useCallback(
    (e) => {
      if (!selectedDataset || !selectedBranch) {
        setError(new Error(t("createProject.pleaseSelectBothDatasetAndBranch")));
        return;
      }
      sendFiles(e.target.files);
      e.target.value = "";
    },
    [sendFiles, selectedDataset, selectedBranch, t],
  );

  const fetchOwners = useCallback(async () => {
    if (ownersFetched) return;
    setLoadingOwners(true);
    try {
      const data = await api.callApi("organizationList");
      const list = Array.isArray(data) ? data : [];
      setOwners(list);
      // 默认选中个人（type=user）
      const personal = list.find((o) => o.type === "user");
      if (personal) setSelectedOwner(personal.path);
      else if (list.length > 0) setSelectedOwner(list[0].path);
    } catch (err) {
      console.error("Failed to fetch owners:", err);
      setOwners([]);
    } finally {
      setLoadingOwners(false);
      setOwnersFetched(true);
    }
  }, [api, ownersFetched]);

  const fetchDatasets = useCallback(async () => {
    if (datasetsFetched || !selectedOwner) return;
    setLoadingDatasets(true);
    try {
      const owner = owners.find((o) => o.path === selectedOwner);
      let data;
      if (owner?.type === "user") {
        // 个人：当前用户的数据集
        data = await api.callApi("publicList");
      } else if (owner?.type === "organization") {
        // 组织：用 namespace path 作为 org_name
        data = await api.callApi("organizationDatasets", {
          params: { org_name: selectedOwner },
        });
      } else {
        setDatasets([]);
        setLoadingDatasets(false);
        return;
      }
      const list = Array.isArray(data) ? data : [];
      setDatasets(list.map((item) => ({ value: item, label: item })));
    } catch (err) {
      console.error("Failed to fetch datasets:", err);
      setDatasets([]);
    } finally {
      setLoadingDatasets(false);
      setDatasetsFetched(true);
    }
  }, [api, datasetsFetched, selectedOwner, owners]);

  const fetchBranches = useCallback(
    async (repoId) => {
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
        setError(new Error(t("createProject.failedToLoadBranches")));
      } finally {
        setLoadingBranches(false);
      }
    },
    [api, t],
  );

  useEffect(() => {
    // 初始化时加载数据所有者列表
    if (!ownersFetched) fetchOwners();
  }, [fetchOwners, ownersFetched]);

  useEffect(() => {
    // 数据所有者变化时，重置并重新加载数据集
    setDatasetsFetched(false);
    setDatasets([]);
    setSelectedDataset("");
    setBranches([]);
    setSelectedBranch("");
  }, [selectedOwner]);

  useEffect(() => {
    // 加载数据集列表
    if (!datasetsFetched && selectedOwner) {
      fetchDatasets();
    }
  }, [fetchDatasets, datasetsFetched, selectedOwner]);

  useEffect(() => {
    if (selectedDataset) {
      fetchBranches(selectedDataset);
      setSelectedBranch("");
    } else {
      setBranches([]);
    }
  }, [selectedDataset, fetchBranches]);

  const onLoadDataset = useCallback(
    (e) => {
      e.preventDefault();
      setError(null);
      if (!selectedDataset || !selectedBranch) {
        setError(new Error(t("createProject.pleaseSelectBothDatasetAndBranchForUrl")));
        return;
      }
      onWaiting?.(true);
      const body = new URLSearchParams({
        dataset: selectedDataset,
        datasetBranches: selectedBranch,
      });
      importFilesImmediately([{ name: `${selectedDataset}@${selectedBranch}` }], body);
    },
    [importFilesImmediately, selectedDataset, selectedBranch, onWaiting, t],
  );

  const openConfig = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      openLabelingConfig?.();
    },
    [openLabelingConfig],
  );

  useEffect(() => {
    if (project?.id !== undefined) {
      loadFilesList().then((files) => {
        if (csvHandling) return;
        // empirical guess on start if we have some possible tasks list/structured data problem
        if (Array.isArray(files) && files.some(({ file }) => /\.[ct]sv$/.test(file))) {
          setCsvHandling("choose");
        }
      });
    }
  }, [project?.id, loadFilesList]);

  if (!project) return null;
  if (!show) return null;

  const csvProps = {
    name: "csv",
    type: "radio",
    onChange: (e) => setCsvHandling(e.target.value),
  };

  return (
    <div className={importClass}>
      {highlightCsvHandling && <div className={importClass.elem("csv-splash")} />}
      <input id="file-input" type="file" name="file" multiple onChange={onUpload} style={{ display: "none" }} />

      <header className="flex gap-4">
        <form
          className={`${importClass.elem("dataset-selector")} inline-flex items-stretch gap-2`}
          method="POST"
          onSubmit={onLoadDataset}
        >
          {/* 数据所有者（个人 + 组织，默认个人） */}
          <label className={`${importClass.elem("field")} inline-flex items-center gap-1`}>
            <span className={importClass.elem("field-label")}>{t("createProject.dataOwnerLabel")}</span>
            <select
              className={importClass.elem("native-select")}
              value={selectedOwner}
              onChange={(e) => setSelectedOwner(e.target.value)}
              disabled={loadingOwners}
              aria-label={t("createProject.selectOwnerType")}
            >
              {owners.length === 0 && <option value="">{t("createProject.selectOwnerType")}</option>}
              {owners.map((o) => (
                <option key={o.path} value={o.path}>
                  {o.type === "user"
                    ? `${o.path}（${t("createProject.personal")}）`
                    : `${o.path}（${t("createProject.organization")}）`}
                </option>
              ))}
            </select>
          </label>

          {/* 数据来源 */}
          <label className={`${importClass.elem("field")} inline-flex items-center gap-1`}>
            <span className={importClass.elem("field-label")}>{t("createProject.dataSourceLabel")}</span>
            <select
              className={importClass.elem("native-select")}
              value={selectedDataset}
              onChange={(e) => setSelectedDataset(e.target.value)}
              disabled={loadingDatasets || !selectedOwner}
              aria-label={t("createProject.selectDataset")}
            >
              <option value="">{t("createProject.selectDataset")}</option>
              {datasets.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>

          {/* 数据来源分支 */}
          <label className={`${importClass.elem("field")} inline-flex items-center gap-1`}>
            <span className={importClass.elem("field-label")}>{t("createProject.branchLabel")}</span>
            <select
              className={importClass.elem("native-select")}
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              disabled={!selectedDataset || loadingBranches}
              aria-label={t("createProject.selectBranch")}
            >
              <option value="">{t("createProject.selectBranch")}</option>
              {branches.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="submit"
            variant="primary"
            look="outlined"
            aria-label={t("createProject.addDataset")}
            disabled={files.uploaded.length > 0}
          >
            {t("createProject.addDataset")}
          </Button>
        </form>
        <span>{t("createProject.or")}</span>
        <Button
          variant="primary"
          look="outlined"
          type="button"
          onClick={() => document.getElementById("file-input").click()}
          leading={<IconUpload />}
          aria-label={t("createProject.uploadFile")}
          disabled={isUploadDisabled}
        >
          {files.uploaded.length ? t("createProject.uploadMoreFiles") : t("createProject.uploadFile")}
        </Button>
        {ff.isActive(ff.FF_SAMPLE_DATASETS) && (
          <SampleDatasetSelect samples={samples} sample={sample} onSampleApplied={onSampleDatasetSelect} />
        )}
        <div
          className={importClass.elem("csv-handling").mod({ highlighted: highlightCsvHandling, hidden: !csvHandling })}
        >
          <span>{t("createProject.treatCsvAs")}</span>
          <label>
            <input {...csvProps} value="tasks" checked={csvHandling === "tasks"} /> {t("createProject.listOfTasks")}
          </label>
          <label>
            <input {...csvProps} value="ts" checked={csvHandling === "ts"} /> {t("createProject.timeSeriesOrWholeTextFile")}
          </label>
        </div>
        <div className={importClass.elem("status")}>
          {files.uploaded.length ? `${files.uploaded.length} ${t("createProject.filesUploaded")}` : ""}
        </div>
      </header>

      <ErrorMessage error={error} />

      <main>
        <Upload sendFiles={sendFiles} disabled={isUploadDisabled}>
          <div
            className={scn("flex gap-4 w-full min-h-full", {
              "justify-center": !showList,
            })}
          >
            {!showList && (
              <div className="flex gap-4 justify-center items-start w-full h-full">
                <label htmlFor="file-input" className="w-full h-full">
                  <div className={`${dropzoneClass.elem("content")} w-full`}>
                    <IconFileUpload height="64" className={dropzoneClass.elem("icon")} />
                    {(!selectedDataset || !selectedBranch) && (
                      <header>
                        {t("createProject.uploadDisabled")}
                        <br />
                        {t("createProject.selectDatasetAndBranch")}
                      </header>
                    )}
                    {(selectedDataset && selectedBranch) && (
                      <header>
                        {t("createProject.dragDropFiles")}
                        <br />
                        {t("createProject.orClickToBrowse")}
                      </header>
                    )}
                    <dl>
                      <dt>{t("createProject.images")}</dt>
                      <dd>{supportedExtensions.image.join(", ")}</dd>
                      <dt>{t("createProject.audio")}</dt>
                      <dd>{supportedExtensions.audio.join(", ")}</dd>
                      <dt>
                        <div className="flex items-center gap-1">
                          {t("createProject.video")}
                          <Tooltip title={t("createProject.videoFormatSupport")}>
                            <a
                              href="https://labelstud.io/tags/video#Video-format"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center"
                              aria-label={t("createProject.learnMoreVideoFormat")}
                            >
                              <IconInfoOutline className="w-4 h-4 text-primary-content hover:text-primary-content-hover" />
                            </a>
                          </Tooltip>
                        </div>
                      </dt>
                      <dd>{supportedExtensions.video.join(", ")}</dd>
                      <dt>{t("createProject.htmlHypertext")}</dt>
                      <dd>{supportedExtensions.html.join(", ")}</dd>
                      <dt>{t("createProject.text")}</dt>
                      <dd>{supportedExtensions.text.join(", ")}</dd>
                      <dt>{t("createProject.structuredData")}</dt>
                      <dd>{supportedExtensions.structuredData.join(", ")}</dd>
                    </dl>
                    <div className="tips">
                      <b>{t("createProject.important")}</b>
                      <ul className="mt-2 ml-4 list-disc font-normal">
                        <li>
                          {t("createProject.recommendCloudStorage")}{" "}
                          <a
                            href="https://labelstud.io/guide/storage.html"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={t("createProject.cloudStorageDocumentation")}
                          >
                            Cloud Storage
                          </a>{" "}
                          <a
                            href="https://labelstud.io/guide/tasks.html#Import-data-from-the-Label-Studio-UI"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={t("createProject.uploadLimitationsDocumentation")}
                          >
                            upload limitations
                          </a>
                          .
                        </li>
                        <li>
                          {t("createProject.forPdfs")}{" "}
                          <a
                            href="https://labelstud.io/templates/multi-page-document-annotation"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={t("createProject.multiImageLabelingDocumentation")}
                          >
                            {t("createProject.multiImageLabeling")}
                          </a>
                          .
                        </li>
                        <li>
                          {t("createProject.checkDocumentation")}{" "}
                          <a target="_blank" href="https://labelstud.io/guide/predictions.html" rel="noreferrer">
                            {t("createProject.importPreannotatedData")}
                          </a>
                          .
                        </li>
                      </ul>
                    </div>
                  </div>
                </label>
              </div>
            )}

            {showList && (
              <div className="w-full">
                <SimpleCard
                  title={t("createProject.files")}
                  className="w-full h-full"
                  contentClassName="overflow-y-auto h-[calc(100%-48px)]"
                >
                  <table className="w-full">
                    <tbody>
                      {sample && (
                        <tr key={sample.url}>
                          <td>
                            <div className="flex items-center gap-2">
                              {sample.title}
                              <Badge variant="info" className="h-5 text-xs rounded-sm">
                                {t("createProject.sample")}
                              </Badge>
                            </div>
                          </td>
                          <td>{sample.description}</td>
                          <td>
                            <Button size="smaller" variant="negative" onClick={() => onSampleDatasetSelect(undefined)}>
                              <IconTrash className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      )}
                      {files.uploaded.map((file) => {
                        const truncatedFilename = truncate(
                          file.file,
                          FILENAME_TRUNCATE_START,
                          FILENAME_TRUNCATE_END,
                          "...",
                        );
                        return (
                          <tr
                            key={file.file}
                            className={newlyUploadedFiles.has(file.id) ? importClass.elem("upload-flash") : ""}
                          >
                            <td className={importClass.elem("file-name")}>
                              <Tooltip title={file.file}>
                                <Typography variant="body" size="small" className="truncate">
                                  {truncatedFilename}
                                </Typography>
                              </Tooltip>
                            </td>
                            <td>
                              <span className={importClass.elem("file-status")} />
                            </td>
                            <td className={importClass.elem("file-size")}>
                              <Typography
                                variant="body"
                                size="smaller"
                                className="text-nowrap text-neutral-content-subtle text-right"
                              >
                                {file.size ? formatFileSize(file.size) : ""}
                              </Typography>
                            </td>
                          </tr>
                        );
                      })}
                      {files.uploading.map((file, idx) => {
                        const truncatedFilename = truncate(
                          file.name,
                          FILENAME_TRUNCATE_START,
                          FILENAME_TRUNCATE_END,
                          "...",
                        );
                        return (
                          <tr key={`${idx}-${file.name}`}>
                            <td className={importClass.elem("file-name")}>
                              <Tooltip title={file.name}>
                                <Typography variant="body" size="small" className="truncate">
                                  {truncatedFilename}
                                </Typography>
                              </Tooltip>
                            </td>
                            <td>
                              <span className={importClass.elem("file-status").mod({ uploading: true })} />
                            </td>
                            <td className={importClass.elem("file-size")}>&nbsp;</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </SimpleCard>
              </div>
            )}

            {ff.isFF(ff.FF_JSON_PREVIEW) && (
              <div className="w-full h-full flex flex-col min-h-[400px]">
                {projectConfigured ? (
                  <SimpleCard
                    title={t("createProject.expectedInputPreview")}
                    className="w-full h-full overflow-hidden flex flex-col"
                    contentClassName="h-[calc(100%-48px)]"
                    flushContent
                  >
                    {sampleConfig.data ? (
                      <div className={importClass.elem("code-wrapper")}>
                        <CodeBlock
                          title={t("createProject.expectedInputPreview")}
                          code={sampleConfig?.data ?? ""}
                          className="w-full h-full"
                        />
                      </div>
                    ) : sampleConfig.isLoading ? (
                      <div className="w-full flex justify-center py-12">
                        <Spinner className="h-6 w-6" />
                      </div>
                    ) : sampleConfig.isError ? (
                      <div className="w-[calc(100%-24px)] text-lg text-negative-content bg-negative-background border m-3 rounded-md border-negative-border-subtle p-4">
                        {t("createProject.somethingWentWrong")}
                      </div>
                    ) : null}
                  </SimpleCard>
                ) : (
                  <SimpleCard className="w-full h-full flex flex-col items-center justify-center text-center p-wide">
                    <div className="flex flex-col items-center gap-tight">
                      <div className="bg-primary-background rounded-largest p-tight flex items-center justify-center">
                        <IconCode className="w-6 h-6 text-primary-icon" />
                      </div>
                      <div className="flex flex-col items-center gap-tighter">
                        <div className="text-label-small text-neutral-content font-medium">{t("createProject.viewJsonInputFormat")}</div>
                        <div className="text-body-small text-neutral-content-subtler text-center">
                          {t("createProject.setupLabelingConfiguration")}{" "}
                          <Button
                            type="button"
                            look="string"
                            onClick={openConfig}
                            className="border-none bg-none p-0 m-0 text-primary-content underline"
                          >
                            {t("createProject.labelingConfiguration")}
                          </Button>{" "}
                          first to preview the expected JSON data format
                        </div>
                      </div>
                    </div>
                  </SimpleCard>
                )}
              </div>
            )}
          </div>
        </Upload>
      </main>
    </div>
  );
};
