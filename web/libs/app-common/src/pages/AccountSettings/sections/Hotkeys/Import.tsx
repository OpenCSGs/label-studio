import { useState } from "react";
import { Button } from "@humansignal/ui";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@humansignal/shad/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@humansignal/shad/components/ui/alert";

// Type definitions
interface Hotkey {
  id: string;
  section: string;
  element: string;
  label: string;
  key: string;
  mac?: string;
  active: boolean;
  subgroup?: string;
  description?: string;
}

interface ImportData {
  hotkeys?: Hotkey[];
  settings?: {
    autoTranslatePlatforms?: boolean;
  };
}

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (data: ImportData | Hotkey[]) => void | Promise<void>;
}

/**
 * ImportDialog - A dialog component for importing hotkey configurations
 *
 * This component allows users to import hotkey configurations by pasting JSON data.
 * It validates the imported data structure and provides error feedback.
 *
 * @param {ImportDialogProps} props - The component props
 * @returns {React.ReactElement} The ImportDialog component
 */
export const ImportDialog = ({ open, onOpenChange, onImport }: ImportDialogProps) => {
  const { t } = useTranslation();
  // State for the import text input
  const [importText, setImportText] = useState<string>("");
  // State for validation errors
  const [error, setError] = useState<string>("");

  /**
   * Validates a single hotkey object structure
   * @param {unknown} hotkey - The hotkey object to validate
   * @throws {Error} If the hotkey is missing required fields
   */
  const validateHotkey = (hotkey: unknown): void => {
    if (!hotkey || typeof hotkey !== "object") {
      throw new Error(t("hotkeys.invalidHotkeyObject"));
    }

    const hotkeyObj = hotkey as Record<string, unknown>;
    const requiredFields = ["id", "section", "element", "label", "key"];
    const missingFields = requiredFields.filter((field) => !hotkeyObj[field]);

    if (missingFields.length > 0) {
      throw new Error(t("hotkeys.missingRequiredFields", { fields: missingFields.join(", ") }));
    }
  };

  /**
   * Handles the import process
   * Parses JSON, validates structure, and calls the onImport callback
   */
  const handleImport = (): void => {
    try {
      // Clear any previous errors
      setError("");

      // Validate input exists
      if (!importText.trim()) {
        throw new Error(t("hotkeys.pleaseEnterJsonData"));
      }

      // Parse the JSON
      const parsedData: unknown = JSON.parse(importText);

      // Handle both old format (array of hotkeys) and new format (object with hotkeys and settings)
      let hotkeys: unknown[];

      if (Array.isArray(parsedData)) {
        // Old format: direct array of hotkeys
        hotkeys = parsedData;
      } else if (parsedData && typeof parsedData === "object" && "hotkeys" in parsedData) {
        // New format: object with hotkeys property
        const dataObj = parsedData as { hotkeys?: unknown };
        if (!Array.isArray(dataObj.hotkeys)) {
          throw new Error(t("hotkeys.invalidFormatHotkeysArray"));
        }
        hotkeys = dataObj.hotkeys;
      } else {
        throw new Error(t("hotkeys.invalidFormatExpected"));
      }

      // Validate it's not empty
      if (hotkeys.length === 0) {
        throw new Error(t("hotkeys.noHotkeysFound"));
      }

      // Validate each hotkey object
      hotkeys.forEach((hotkey: unknown, index: number) => {
        try {
          validateHotkey(hotkey);
        } catch (validationError: unknown) {
          const errorMessage = validationError instanceof Error ? validationError.message : t("hotkeys.unknownValidationError");
          throw new Error(t("hotkeys.hotkeyAtIndexError", { index, error: errorMessage }));
        }
      });

      // If validation passes, proceed with import
      onImport(parsedData as ImportData | Hotkey[]);

      // Reset the dialog state
      resetDialogState();
    } catch (err: unknown) {
      // Set error message for display
      const errorMessage = err instanceof Error ? err.message : t("hotkeys.unknownError");
      setError(errorMessage);
    }
  };

  /**
   * Resets the dialog to its initial state
   */
  const resetDialogState = (): void => {
    setImportText("");
    setError("");
    onOpenChange(false);
  };

  /**
   * Handles dialog cancellation
   */
  const handleCancel = (): void => {
    resetDialogState();
  };

  /**
   * Handles textarea input changes
   * @param {React.ChangeEvent<HTMLTextAreaElement>} e - The change event
   */
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    setImportText(e.target.value);
    // Clear error when user starts typing
    if (error) {
      setError("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px] bg-neutral-surface">
        <DialogHeader>
          <DialogTitle>{t("hotkeys.importHotkeys")}</DialogTitle>
          <DialogDescription>
            {t("hotkeys.importHotkeysDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <label
            htmlFor="import-json"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {t("hotkeys.hotkeysJson")}
          </label>
          <textarea
            id="import-json"
            className="flex min-h-[150px] w-full rounded-md border border-neutral-border bg-transparent px-tight py-tighter typography-body-small placeholder:text-neutral-content-subtler focus-visible:ring-4 focus-visible:ring-primary-focus-outline focus-visible:border-neutral-border-bolder focus-visible:outline-0 transition-all resize-none"
            placeholder='[{"id": 1, "section": "annotation-actions", "element": "button", "label": "Save", "key": "Ctrl+S"}]'
            value={importText}
            onChange={handleTextareaChange}
            aria-describedby={error ? "import-error" : undefined}
          />

          {error && (
            <Alert variant="destructive" id="import-error">
              <AlertTitle>{t("hotkeys.importError")}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="neutral" onClick={handleCancel}>
            {t("hotkeys.cancel")}
          </Button>
          <Button onClick={handleImport} disabled={!importText.trim()}>
            {t("hotkeys.importHotkeys")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
