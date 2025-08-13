import { useSDK } from "../../providers/SDKProvider";
import { Button } from "@humansignal/ui";

const SDKButton = ({ eventName, ...props }) => {
  const sdk = useSDK();

  return sdk.hasHandler(eventName) ? (
    <Button
      {...props}
      size={props.size ?? "small"}
      look={props.look ?? "outlined"}
      variant={props.variant ?? "neutral"}
      aria-label={`${eventName.replace("Clicked", "")} button`}
      onClick={() => {
        sdk.invoke(eventName);
      }}
    />
  ) : null;
};

export const SettingsButton = ({ ...props }) => {
  return <SDKButton {...props} eventName="settingsClicked" />;
};

export const ImportButton = ({ ...props }) => {
  return <SDKButton {...props} eventName="importClicked" />;
};

export const ExportButton = ({ ...props }) => {
  return <SDKButton {...props} eventName="exportClicked" />;
};
