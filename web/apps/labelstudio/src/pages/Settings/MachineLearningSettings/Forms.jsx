import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@humansignal/ui";
import { ErrorWrapper } from "../../../components/Error/Error";
import { InlineError } from "../../../components/Error/InlineError";
import { Form, Input, Select, TextArea, Toggle } from "../../../components/Form";
import { Modal } from "../../../components/Modal/Modal";
import { useAPI } from "../../../providers/ApiProvider";
import "./MachineLearningSettings.scss";

const CustomBackendForm = ({ action, backend, project, onSubmit }) => {
  const { t } = useTranslation();
  const api = useAPI();
  const [selectedAuthMethod, setAuthMethod] = useState("NONE");
  const [, setMLError] = useState();
  const [hasLSKey, setHasLSKey] = useState(null);
  const [creatingLSKey, setCreatingLSKey] = useState(false);
  const [showEntitySegmentHelp, setShowEntitySegmentHelp] = useState(false);
  const [useThirdPartyModels, setUseThirdPartyModels] = useState(backend?.use_third_party_models ?? true);
  const requiresEntitySegment = /<(BrushLabels|PolygonLabels)\b/.test(project.label_config ?? "");
  const seedKeyDocs = "https://console.volcengine.com/ark/region:cn-beijing/docs/82379/1541594?lang=zh";
  const entitySegmentKeyDocs = "https://docs.volcengine.com/docs/86081/1660009?lang=zh#1I2Ed9UH";
  const entitySegmentServiceDocs = "https://docs.volcengine.com/docs/86081/1660009?lang=zh#Alqoq01b";
  const credentialLabel = (label, href) => (
    <>
      {label}{" "}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: "var(--color-primary-content)", textDecoration: "underline" }}
        onClick={(event) => event.stopPropagation()}
      >
        {t("machineLearning.howToGet")}
      </a>
    </>
  );

  useEffect(() => {
    api
      .callApi("jwtApiTokens")
      .then((response) => setHasLSKey(Array.isArray(response) && response.length > 0))
      .catch(() => setHasLSKey(false));
  }, [api]);

  const createLSKey = async () => {
    setCreatingLSKey(true);
    const response = await api.callApi("createJwtApiToken");
    setHasLSKey(Boolean(response?.token));
    setCreatingLSKey(false);
  };

  return (
    <>
      <Form
      action={action}
      formData={{ ...(backend ?? {}) }}
      params={{ pk: backend?.id }}
      onSubmit={async (response) => {
        if (!response.error_message) {
          onSubmit(response);
        }
      }}
    >
      <Input type="hidden" name="project" value={project.id} />

      <Form.Row columnCount={1}>
        <Input name="title" label={t("machineLearning.name")} placeholder={t("machineLearning.enterName")} required />
      </Form.Row>

      <Form.Row columnCount={1}>
        <Input name="url" label={t("machineLearning.backendUrl")} required />
      </Form.Row>

      <Form.Row columnCount={1}>
        <Toggle
          name="use_third_party_models"
          label={t("machineLearning.useThirdPartyModels")}
          description={t("machineLearning.useThirdPartyModelsDescription")}
          checked={useThirdPartyModels}
          onChange={(event) => setUseThirdPartyModels(event.target.checked)}
        />
      </Form.Row>

      {useThirdPartyModels && (
        <Form.Row columnCount={1}>
          <Input
            name="seed_api_key"
            label={credentialLabel(t("machineLearning.seedApiKey"), seedKeyDocs)}
            type="password"
            placeholder={backend?.seed_api_key_is_set ? "********" : ""}
            required={!backend?.seed_api_key_is_set}
          />
        </Form.Row>
      )}

      {useThirdPartyModels && requiresEntitySegment && (
        <Form.Row columnCount={2}>
            <Input
              name="entity_segment_access_key"
              label={
                <>
                  {t("machineLearning.entitySegmentAccessKey")}{" "}
                  <button
                    type="button"
                    style={{
                      padding: 0,
                      border: 0,
                      background: "none",
                      color: "var(--color-primary-content)",
                      textDecoration: "underline",
                      cursor: "pointer",
                    }}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setShowEntitySegmentHelp(true);
                    }}
                  >
                    {t("machineLearning.howToGet")}
                  </button>
                </>
              }
              type="password"
              placeholder={backend?.entity_segment_access_key_is_set ? "********" : ""}
              required={!backend?.entity_segment_access_key_is_set}
            />
            <Input
              name="entity_segment_secret_key"
              label={t("machineLearning.entitySegmentSecretKey")}
              type="password"
              placeholder={backend?.entity_segment_secret_key_is_set ? "********" : ""}
              required={!backend?.entity_segment_secret_key_is_set}
            />
        </Form.Row>
      )}

      {hasLSKey === false && (
        <div className="p-base mb-base rounded-md border border-negative-border bg-negative-background">
          <div className="mb-tight">{t("machineLearning.lsApiKeyRequired")}</div>
          <Button type="button" onClick={createLSKey} disabled={creatingLSKey}>
            {creatingLSKey ? t("machineLearning.creatingLsApiKey") : t("machineLearning.createLsApiKey")}
          </Button>
        </div>
      )}

      <Form.Row columnCount={2}>
        <Select
          name="auth_method"
          label={t("machineLearning.selectAuthMethod")}
          options={[
            { label: t("machineLearning.noAuthentication"), value: "NONE" },
            { label: t("machineLearning.basicAuthentication"), value: "BASIC_AUTH" },
          ]}
          value={selectedAuthMethod}
          onChange={setAuthMethod}
        />
      </Form.Row>

      {(backend?.auth_method === "BASIC_AUTH" || selectedAuthMethod === "BASIC_AUTH") && (
        <Form.Row columnCount={2}>
          <Input name="basic_auth_user" label="Basic auth user" />
          {backend?.basic_auth_pass_is_set ? (
            <Input name="basic_auth_pass" label="Basic auth pass" type="password" placeholder="********" />
          ) : (
            <Input name="basic_auth_pass" label="Basic auth pass" type="password" />
          )}
        </Form.Row>
      )}

      <Form.Row columnCount={1}>
        <TextArea name="extra_params" label={t("machineLearning.extraParams")} style={{ minHeight: 120 }} />
      </Form.Row>

      <Form.Row columnCount={1}>
        <Toggle
          name="is_interactive"
          label={t("machineLearning.interactivePreannotations")}
          description={t("machineLearning.interactivePreannotationsDescription")}
        />
      </Form.Row>

      <Form.Actions>
        <Button
          type="submit"
          look="primary"
          disabled={!hasLSKey}
          onClick={() => setMLError(null)}
          aria-label={t("machineLearning.validateAndSave")}
        >
          {t("machineLearning.validateAndSave")}
        </Button>
      </Form.Actions>

      <Form.ResponseParser>
        {(response) => (
          <>
            {response.error_message && (
              <ErrorWrapper
                error={{
                  response: {
                    detail: backend
                      ? t("machineLearning.failedToSaveMlBackend")
                      : t("machineLearning.failedToAddMlBackend"),
                    exc_info: response.error_message,
                  },
                }}
              />
            )}
          </>
        )}
      </Form.ResponseParser>

      <InlineError />
      </Form>

      <Modal
        visible={showEntitySegmentHelp}
        title={t("machineLearning.entitySegmentHelpTitle")}
        onHide={() => setShowEntitySegmentHelp(false)}
        style={{ width: 560 }}
      >
        <div className="flex flex-col gap-base p-base">
          <div>{t("machineLearning.entitySegmentServiceNotice")}</div>
          <div className="flex gap-base">
            <a href={entitySegmentServiceDocs} target="_blank" rel="noopener noreferrer">
              {t("machineLearning.enableEntitySegmentService")}
            </a>
            <a href={entitySegmentKeyDocs} target="_blank" rel="noopener noreferrer">
              {t("machineLearning.getEntitySegmentKeys")}
            </a>
          </div>
        </div>
      </Modal>
    </>
  );
};

export { CustomBackendForm };
