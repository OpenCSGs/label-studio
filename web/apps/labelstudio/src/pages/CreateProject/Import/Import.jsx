import { ff } from "@humansignal/core";
import { SampleDatasetSelect } from "@humansignal/app-common/blocks/SampleDatasetSelect/SampleDatasetSelect";
import { IconErrorAlt, IconFileUpload, IconInfoOutline, IconTrash, IconUpload, IconCode } from "@humansignal/icons";
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
import samples from "./samples.json";
import { importFiles } from "./utils";
import { Button, CodeBlock, SimpleCard, Spinner, Tooltip } from "@humansignal/ui";
import { Select } from "@humansignal/ui";

const importClass = cn("upload_page");
const dropzoneClass = cn("dropzone");

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
  pdf: ["pdf"],
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
      style={disabled ? { pointerEvents: 'none', opacity: 0.5 } : {}}
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
      {/* {error.id && `[${error.id}] `}
      {error.detail || error.message}
      {extra && ` (${extra})`} */}
      {extra}
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
  const [error, setError] = useState();
  const api = useAPI();
  const projectConfigured = project?.label_config !== "<View></View>";
  const sampleConfig = useAtomValue(sampleDatasetAtom);

  // 新增状态：数据集和分支相关
  const [datasets, setDatasets] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [loadingDatasets, setLoadingDatasets] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  // 新增状态：标记是否已经尝试获取数据集
  const [datasetsFetched, setDatasetsFetched] = useState(false);
  // 计算上传是否禁用
  const isUploadDisabled = !selectedDataset || !selectedBranch;

  const processFiles = (state, action) => {
    if (action.sending) {
      return { ...state, uploaded: [...action.sending, ...state.uploaded] };
    }
    if (action.sent) {
      return { ...state, uploaded: state.uploaded.filter((f) => !action.sent.includes(f)) };
    }
    if (action.uploaded) {
      return { ...state, uploaded: unique([...state.uploaded, ...action.uploaded], (a, b) => a.id === b.id) };
    }
    if (action.ids) {
      const ids = unique([...state.ids, ...action.ids]);

      onFileListUpdate?.(ids);
      return { ...state, ids };
    }
    return state;
  };

  const [files, dispatch] = useReducer(processFiles, { uploaded: [], uploaded: [], ids: [] });
  const showList = Boolean(files.uploaded?.length || files.uploaded?.length || sample);

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
    // @todo workaround for error about input size in a wrong html format
    if (typeof err === "string" && err.includes("RequestDataTooBig")) {
      const message = "Imported file is too big";
      const extra = err.match(/"exception_value">(.*)<\/pre>/)?.[1];

      err = { message, extra };
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

      return loadFilesList(file_upload_ids);
    },
    [addColumns, loadFilesList],
  );

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
      // 添加验证
      if (!selectedDataset || !selectedBranch) {
        setError(new Error('Please select both dataset and branch before uploading files'));
        return;
      }

      setError(null);
      onWaiting?.(true);
      files = [...files]; // they can be array-like object
      const fd = new FormData();

      // 将数据集和分支添加到 FormData
      fd.append('dataset', selectedDataset);
      fd.append('datasetBranches', selectedBranch);

      for (const f of files) {
        if (!allSupportedExtensions.includes(getFileExtension(f.name))) {
          onError(new Error(`The filetype of file "${f.name}" is not supported.`));
          return;
        }
        fd.append(f.name, f);
      }
      return importFilesImmediately(files, fd);
    },
    [importFilesImmediately, selectedDataset, selectedBranch] // 添加依赖
  );

  const onUpload = useCallback(
    (e) => {
      // 添加验证逻辑
      if (!selectedDataset || !selectedBranch) {
        setError(new Error('Please select both dataset and branch before uploading files'));
        return;
      }

      sendFiles(e.target.files);
      e.target.value = "";
    },
    [sendFiles, selectedDataset, selectedBranch] // 添加依赖
  );

  // 修改fetchDatasets函数
  const fetchDatasets = useCallback(async () => {
    // 如果已经尝试过获取，则不再调用
    if (datasetsFetched) return;

    setLoadingDatasets(true);
    try {
      const data = await api.callApi("publicList");
      const formattedDatasets = Array.isArray(data)
        ? data.map(item => ({ value: item, label: item }))
        : [];
      setDatasets(formattedDatasets);
    } catch (err) {
      console.error('Failed to fetch datasets:', err);
    } finally {
      setLoadingDatasets(false);
      // 无论成功失败，标记为已尝试
      setDatasetsFetched(true);
    }
  }, [api, datasetsFetched]); // 添加依赖

  // 修改fetchBranches函数
  const fetchBranches = useCallback(async (repoId) => {
    if (!repoId) return;

    setLoadingBranches(true);
    try {
      // 替换为api.callApi调用
      const data = await api.callApi("datasetBranches", {
        params: { repo_id: repoId } // 保持参数不变
      });
      const formattedBranches = Array.isArray(data)
        ? data.map(branch => ({
            value: branch,
            label: branch
          }))
        : [];
      setBranches(formattedBranches);
    } catch (err) {
      console.error('Failed to fetch branches:', err);
      setError(new Error('Failed to load branches'));
    } finally {
      setLoadingBranches(false);
    }
  }, [api]); // 添加api依赖

  // 页面加载时获取数据集
  useEffect(() => {
    // 只在未尝试过时获取数据
    if (!datasetsFetched) {
      fetchDatasets();
    }
  }, [fetchDatasets, datasetsFetched]); // 添加依赖

  // 当选中数据集变化时获取对应的分支
  useEffect(() => {
    if (selectedDataset) {
      fetchBranches(selectedDataset);
      setSelectedBranch(''); // 重置分支选择
    } else {
      setBranches([]);
    }
  }, [selectedDataset, fetchBranches]);

  // 修改onLoadURL函数中的请求体
  const onLoadURL = useCallback(
    (e) => {
      e.preventDefault();
      setError(null);

      if (!selectedDataset || !selectedBranch) {
        setError(new Error('Please select both dataset and branch'));
        return;
      }

      onWaiting?.(true);
      // 保持请求体结构不变
      const body = new URLSearchParams({
        dataset: selectedDataset,
        datasetBranches: selectedBranch
      });

      importFilesImmediately([{ name: `${selectedDataset}@${selectedBranch}` }], body);
    },
    [importFilesImmediately, selectedDataset, selectedBranch, onWaiting]
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

  const urlRef = useRef();

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
        {/* 将原URL输入框替换为数据集和分支下拉菜单 */}
        <form
          className={`${importClass.elem("dataset-selector")} inline-flex items-stretch gap-2`}
          method="POST"
          onSubmit={onLoadURL}
        >
          {/* <select
            value={selectedDataset}
            onChange={(e) => setSelectedDataset(e.target.value)}
            disabled={loadingDatasets}
          >
            <option value="">Select a dataset</option>
            {datasets.map(dataset => (
              <option key={dataset.value} value={dataset.value}>
                {dataset.label}
              </option>
            ))}
          </select>

          <select
            className="h-[40px] px-2 border rounded"
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            disabled={loadingBranches || !selectedDataset}
          >
            <option value="">Select Branch</option>
            {branches.map((branch) => (
              <option key={branch.value} value={branch.value}>
                {branch.label}
              </option>
            ))}
          </select> */}

          <Select
            placeholder={'Select a dataset'}
            options={datasets}
            value={selectedDataset}
            onChange={setSelectedDataset}
          />

          <Select
            placeholder={'Select Branch'}
            options={branches}
            value={selectedBranch}
            disabled={!selectedDataset || loadingBranches}
            onChange={setSelectedBranch}
          />

          <Button type="submit" aria-label="Add Dataset" disabled={files.uploaded.length > 0}>
              Add Dataset
          </Button>
        </form>
        <span>or</span>
        <Button
          type="button"
          onClick={() => document.getElementById("file-input").click()}
          leading={<IconUpload />}
          aria-label="Upload file"
          disabled={!selectedDataset || !selectedBranch}
        >
          Upload {files.uploaded.length ? "More " : ""}Files
        </Button>
        {ff.isActive(ff.FF_SAMPLE_DATASETS) && (
          <SampleDatasetSelect samples={samples} sample={sample} onSampleApplied={onSampleDatasetSelect} />
        )}
        <div
          className={importClass.elem("csv-handling").mod({ highlighted: highlightCsvHandling, hidden: !csvHandling })}
        >
          <span>Treat CSV/TSV as</span>
          <label>
            <input {...csvProps} value="tasks" checked={csvHandling === "tasks"} /> List of tasks
          </label>
          <label>
            <input {...csvProps} value="ts" checked={csvHandling === "ts"} /> Time Series or Whole Text File
          </label>
        </div>
        <div className={importClass.elem("status")}>
          {files.uploaded.length ? `${files.uploaded.length} files uploaded` : ""}
        </div>
      </header>

      <ErrorMessage error={error} />

      <main>
        <Upload sendFiles={sendFiles} project={project} disabled={isUploadDisabled}>
          <div className={scn("flex gap-4 w-full min-h-full", { "justify-center": !showList })}>
            {!showList && (
              <div className="flex gap-4 justify-center items-start w-full h-full">
                <label htmlFor="file-input" className="w-full h-full">
                  <div className={`${dropzoneClass.elem("content")} w-full`}>
                    <IconFileUpload height="64" className={dropzoneClass.elem("icon")} />
                    {(!selectedDataset || !selectedBranch) && (
                      <header>
                        Upload Disabled
                        <br />
                        Please select a dataset and branch to enable file upload
                      </header>
                    )}
                    {(selectedDataset && selectedBranch) && (
                      <header>
                        Drag & drop files here
                        <br />
                        or click to browse
                      </header>
                    )}
                    <dl>
                      <dt>Images</dt>
                      <dd>{supportedExtensions.image.join(", ")}</dd>
                      <dt>Audio</dt>
                      <dd>{supportedExtensions.audio.join(", ")}</dd>
                      <dt>
                        <div className="flex items-center gap-1">
                          Video
                          <Tooltip title="Video format support depends on your browser. Click to learn more.">
                            <a
                              href="https://labelstud.io/tags/video#Video-format"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center"
                              aria-label="Learn more about video format support (opens in a new tab)"
                            >
                              <IconInfoOutline className="w-4 h-4 text-primary-content hover:text-primary-content-hover" />
                            </a>
                          </Tooltip>
                        </div>
                      </dt>
                      <dd>{supportedExtensions.video.join(", ")}</dd>
                      <dt>HTML / HyperText</dt>
                      <dd>{supportedExtensions.html.join(", ")}</dd>
                      <dt>Text</dt>
                      <dd>{supportedExtensions.text.join(", ")}</dd>
                      <dt>Structured data</dt>
                      <dd>{supportedExtensions.structuredData.join(", ")}</dd>
                      <dt>PDF</dt>
                      <dd>{supportedExtensions.pdf.join(", ")}</dd>
                    </dl>
                    <div className="tips">
                      <b>Important:</b>
                      <ul className="mt-2 ml-4 list-disc font-normal">
                        <li>
                          We recommend{" "}
                          <a
                            href="https://labelstud.io/guide/storage.html"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Cloud Storage documentation (opens in a new tab)"
                          >
                            Cloud Storage
                          </a>{" "}
                          over direct uploads due to{" "}
                          <a
                            href="https://labelstud.io/guide/tasks.html#Import-data-from-the-Label-Studio-UI"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Upload limitations documentation (opens in a new tab)"
                          >
                            upload limitations
                          </a>
                          .
                        </li>
                        <li>
                          For PDFs, use{" "}
                          <a
                            href="https://labelstud.io/templates/multi-page-document-annotation"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Multi-image labeling documentation (opens in a new tab)"
                          >
                            multi-image labeling
                          </a>
                          . JSONL or Parquet (Enterprise only) files require cloud storage.
                        </li>
                        <li>
                          Check the documentation to{" "}
                          <a target="_blank" href="https://labelstud.io/guide/predictions.html" rel="noreferrer">
                            import preannotated data
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
                <SimpleCard title="Files" className="w-full h-full">
                  <table>
                    <tbody>
                      {sample && (
                        <tr key={sample.url}>
                          <td>
                            <div className="flex items-center gap-2">
                              {sample.title}
                              <Badge variant="info" className="h-5 text-xs rounded-sm">
                                Sample
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
                      {/* {files.uploaded.map((file, idx) => (
                        <tr key={`${idx}-${file.name}`}>
                          <td>{file.name}</td>
                          <td colSpan={2}>
                            <span className={importClass.elem("file-status").mod({ uploaded: true })} />
                          </td>
                        </tr>
                      ))} */}
                      {files.uploaded.map((file) => (
                        <tr key={file.file}>
                          <td>{file.file}</td>
                          <td>
                            <span className={importClass.elem("file-status")} />
                          </td>
                          <td>{file.size}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </SimpleCard>
              </div>
            )}

            {ff.isFF(ff.FF_JSON_PREVIEW) && (
              <div className="w-full h-full flex flex-col min-h-[400px]">
                {projectConfigured ? (
                  <SimpleCard
                    title="Expected Input Preview"
                    className="w-full h-full overflow-hidden flex flex-col"
                    contentClassName="h-[calc(100%-48px)]"
                    flushContent
                  >
                    {sampleConfig.data ? (
                      <div className={importClass.elem("code-wrapper")}>
                        <CodeBlock
                          title="Expected Input Preview"
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
                        Something went wrong, the sample data could not be loaded.
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
                        <div className="text-label-small text-neutral-content font-medium">View JSON input format</div>
                        <div className="text-body-small text-neutral-content-subtler text-center">
                          Setup your{" "}
                          <Button
                            type="button"
                            look="string"
                            onClick={openConfig}
                            className="border-none bg-none p-0 m-0 text-primary-content underline"
                          >
                            labeling configuration
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
