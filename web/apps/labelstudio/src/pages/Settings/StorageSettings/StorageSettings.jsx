import { cn } from "../../../utils/bem";
import { StorageSet } from "./StorageSet";
import { isInLicense, LF_CLOUD_STORAGE_FOR_MANAGERS } from "../../../utils/license-flags";
import { Typography } from "@humansignal/ui";

const isAllowCloudStorage = !isInLicense(LF_CLOUD_STORAGE_FOR_MANAGERS);

export const StorageSettings = () => {
  const rootClass = cn("storage-settings"); // TODO: Remove in the next BEM cleanup

  return isAllowCloudStorage ? (
    <section className="max-w-[680px]">
      <Typography variant="headline" size="medium" className="mb-base">
        Cloud Storage
      </Typography>
      <Typography size="small" className="text-neutral-content-subtler mb-wider">
        Use cloud or database storage as the source for your labeling tasks or the target of your completed annotations.
      </Typography>

      <div className="grid grid-cols-2 gap-8">
        <StorageSet title="Source Cloud Storage" buttonLabel="Add Source Storage" rootClass={rootClass} />

        <StorageSet
          title="Target Cloud Storage"
          target="export"
          buttonLabel="Add Target Storage"
          rootClass={rootClass}
        />
      </div>
    </section>
  ) : null;
};

StorageSettings.title = "Cloud Storage";
StorageSettings.path = "/storage";
