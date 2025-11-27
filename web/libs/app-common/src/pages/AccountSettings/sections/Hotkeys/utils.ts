import { DEFAULT_HOTKEYS, HOTKEY_SECTIONS } from "./defaults";

// Type definitions - centralized here to avoid duplication
export interface Hotkey {
  id: string;
  section: string;
  element: string;
  label: string;
  key: string;
  mac?: string;
  active: boolean;
  description?: string;
  subgroup?: string;
}

// Type for translation function
export type TranslationFunction = (key: string) => string;

export interface Section {
  id: string;
  title: string;
  description?: string;
}

export interface DirtyState {
  [sectionId: string]: boolean;
}

export interface DuplicateConfirmDialog {
  open: boolean;
  hotkeyId: string | null;
  newKey: string | null;
  conflictingHotkeys: Hotkey[];
}

export type HotkeySettings = Record<string, unknown>;

export interface ExportData {
  hotkeys: Hotkey[];
  settings: HotkeySettings;
  exportedAt: string;
  version: string;
}

export interface ImportData {
  hotkeys?: Hotkey[];
  settings?: HotkeySettings;
}

export interface SaveResult {
  ok: boolean;
  error?: string;
  data?: unknown;
}

export interface ApiResponse {
  custom_hotkeys?: Record<string, { key: string; active: boolean; description?: string }>;
  hotkey_settings?: HotkeySettings;
  error?: string;
}

// Type definition for the raw hotkey data from defaults
interface RawHotkey {
  id: number;
  section: string;
  element: string;
  label: string;
  key: string;
  mac?: string;
  active: boolean;
  description?: string;
}

// Convert DEFAULT_HOTKEYS with numeric IDs to typed hotkeys with string IDs
export const getTypedDefaultHotkeys = (t?: TranslationFunction): Hotkey[] => {
  const hotkeys = (DEFAULT_HOTKEYS as RawHotkey[]).map((hotkey) => ({
    ...hotkey,
    id: String(hotkey.id), // Convert numeric id to string
  }));
  
  // If translation function is provided, translate labels and descriptions
  if (t) {
    return hotkeys.map((hotkey) => {
      const hotkeyKey = hotkey.element.replace(/:/g, ".").toLowerCase();
      
      // Translate label
      const labelKey = `hotkeys.hotkeys.${hotkeyKey}.label`;
      const translatedLabel = t(labelKey);
      const label = translatedLabel !== labelKey ? translatedLabel : hotkey.label;
      
      // Translate description
      const descKey = `hotkeys.hotkeys.${hotkeyKey}.description`;
      const translatedDesc = t(descKey);
      const description = translatedDesc !== descKey ? translatedDesc : hotkey.description;
      
      return {
        ...hotkey,
        label,
        description,
      };
    });
  }
  
  return hotkeys;
};

// Global property declaration
declare global {
  interface Window {
    DEFAULT_HOTKEYS?: Hotkey[];
  }
}

// Get translated sections
export const getTranslatedSections = (t?: TranslationFunction): Section[] => {
  const sections = HOTKEY_SECTIONS as Section[];
  
  if (t) {
    return sections.map((section) => {
      const sectionKey = section.id.toLowerCase().replace(/_/g, "");
      
      // Translate title
      const titleKey = `hotkeys.sections.${sectionKey}.title`;
      const translatedTitle = t(titleKey);
      const title = translatedTitle !== titleKey ? translatedTitle : section.title;
      
      // Translate description
      const descKey = `hotkeys.sections.${sectionKey}.description`;
      const translatedDesc = t(descKey);
      const description = translatedDesc !== descKey ? translatedDesc : section.description;
      
      return {
        ...section,
        title,
        description,
      };
    });
  }
  
  return sections;
};

// Global property setup function - called explicitly rather than as side effect
export const setupGlobalHotkeys = (): void => {
  if (typeof window !== "undefined") {
    // Declare global property if not already present
    if (!window.DEFAULT_HOTKEYS) {
      window.DEFAULT_HOTKEYS = getTypedDefaultHotkeys();
    }
  }
};
