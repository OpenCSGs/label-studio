import { useCallback, useRef, useState } from "react";
import { useHistory } from "react-router";
import { Button } from "@humansignal/ui";
import { Modal } from "../../../components/Modal/Modal";
import { Space } from "../../../components/Space/Space";
import { useAPI } from "../../../providers/ApiProvider";
import { ProjectProvider, useProject } from "../../../providers/ProjectProvider";
import { useFixedLocation } from "../../../providers/RoutesProvider";
import { Elem } from "../../../utils/bem";
import { useRefresh } from "../../../utils/hooks";
import { ImportPage } from "./Import";
import { useImportPage } from "./useImportPage";
import { useTranslation } from "react-i18next";

export const Inner = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const location = useFixedLocation();
  const modal = useRef();
  const refresh = useRefresh();
  const { project } = useProject();
  const [waiting, setWaitingStatus] = useState(false);
  const [sample, setSample] = useState(null);
  const api = useAPI();

  const { uploading, uploadDisabled, finishUpload, fileIds, pageProps, uploadSample } = useImportPage(project);

  const backToDM = useCallback(() => {
    const path = location.pathname.replace(ImportModal.path, "");
    const search = location.search;
    const pathname = `${path}${search !== "?" ? search : ""}`;

    return refresh(pathname);
  }, [location, history]);

  const onCancel = useCallback(async () => {
    setWaitingStatus(true);
    await api.callApi("deleteFileUploads", {
      params: {
        pk: project.id,
      },
      body: {
        file_upload_ids: fileIds,
      },
    });
    setWaitingStatus(false);
    modal?.current?.hide();
    backToDM();
  }, [modal, project, fileIds, backToDM]);

  const onFinish = useCallback(async () => {
    if (sample) {
      await uploadSample(
        sample,
        () => setWaitingStatus(true),
        () => setWaitingStatus(false),
      );
    }

    const imported = await finishUpload();

    if (!imported) return;
    backToDM();
  }, [backToDM, finishUpload, sample]);

  return (
    <Modal
      title={t("dataManager.importData")}
      ref={modal}
      onHide={() => backToDM()}
      closeOnClickOutside={false}
      fullscreen
      visible
      bare
    >
      <Modal.Header divided>
        <Elem block="modal" name="title">
          {t("dataManager.importData")}
        </Elem>

        <Space>
          <Button
            size="small"
            variant="negative"
            look="outlined"
            waiting={waiting}
            onClick={onCancel}
            aria-label={t("dataManager.cancelImport")}
          >
            {t("createProject.cancel")}
          </Button>
          <Button
            size="small"
            onClick={onFinish}
            waiting={waiting || uploading}
            disabled={uploadDisabled}
            aria-label={t("dataManager.finishImport")}
          >
            {t("dataManager.import")}
          </Button>
        </Space>
      </Modal.Header>
      <ImportPage
        project={project}
        sample={sample}
        onSampleDatasetSelect={setSample}
        projectConfigured={Object.keys(project.parsed_label_config ?? {}).length > 0}
        openLabelingConfig={() => {
          history.push(`/projects/${project.id}/settings/labeling`);
        }}
        {...pageProps}
      />
    </Modal>
  );
};
export const ImportModal = () => {
  return (
    <ProjectProvider>
      <Inner />
    </ProjectProvider>
  );
};

ImportModal.path = "/import";
ImportModal.modal = true;
