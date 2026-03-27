import React, { type FC, type ReactNode } from "react";
import {
  IconUpload,
  IconLsLabeling,
  IconCheck,
  IconSearch,
  IconInbox,
  IconCloudProviderS3,
  IconCloudProviderGCS,
  IconCloudProviderAzure,
  IconCloudProviderRedis,
} from "@humansignal/icons";
import { Button, IconExternal, Typography, Tooltip } from "@humansignal/ui";
import { getDocsUrl } from "../../../../../../editor/src/utils/docs";
import { ABILITY, useAuth } from "@humansignal/core/providers/AuthProvider";

declare global {
  interface Window {
    APP_SETTINGS?: {
      whitelabel_is_active?: boolean;
    };
  }
}

// TypeScript interfaces for props
interface EmptyStateProps {
  t?: (key: string) => string;
  canImport: boolean;
  onOpenSourceStorageModal?: () => void;
  onOpenImportModal?: () => void;
  // Role-based props (optional)
  userRole?: string;
  project?: {
    assignment_settings?: {
      label_stream_task_distribution?: "auto_distribution" | "assigned_only" | string;
    };
  };
  hasData?: boolean;
  hasFilters?: boolean;
  canLabel?: boolean;
  onLabelAllTasks?: () => void;
  onClearFilters?: () => void;
}

// Internal helper interfaces and types
interface EmptyStateLayoutProps {
  icon: ReactNode;
  iconBackground?: string;
  iconColor?: string;
  title: string;
  description: string;
  actions?: ReactNode;
  additionalContent?: ReactNode;
  footer?: ReactNode;
  testId?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  wrapperClassName?: string;
}

// Internal helper function to render common empty state structure
const renderEmptyStateLayout = ({
  icon,
  iconBackground = "bg-primary-emphasis",
  iconColor = "text-primary-icon",
  title,
  description,
  actions,
  additionalContent,
  footer,
  testId,
  ariaLabelledBy,
  ariaDescribedBy,
  wrapperClassName = "w-full h-full flex flex-col items-center justify-center text-center p-wide",
}: EmptyStateLayoutProps) => {
  // Clone the icon and ensure it has consistent 40x40 size
  const iconWithSize = React.cloneElement(icon as React.ReactElement, {
    width: 40,
    height: 40,
  });

  const content = (
    <div className={wrapperClassName}>
      <div className={`flex items-center justify-center ${iconBackground} ${iconColor} rounded-full p-tight mb-4`}>
        {iconWithSize}
      </div>

      <Typography variant="headline" size="medium" className="mb-tight" id={ariaLabelledBy}>
        {title}
      </Typography>

      <Typography
        size="medium"
        className={`text-neutral-content-subtler max-w-xl ${actions || additionalContent ? "mb-tight" : ""}`}
        id={ariaDescribedBy}
      >
        {description}
      </Typography>

      {additionalContent}

      {actions &&
        (() => {
          // Flatten children and filter out null/false values to count actual rendered elements
          const flattenedActions = React.Children.toArray(actions).flat().filter(Boolean);
          const actualActionCount = flattenedActions.length;
          const isSingleAction = actualActionCount === 1;

          return (
            <div className={`flex ${isSingleAction ? "justify-center" : ""} gap-base w-full max-w-md mt-base`}>
              {actions}
            </div>
          );
        })()}

      {footer && <div className="mt-6">{footer}</div>}
    </div>
  );

  // For import state, we need special wrapper structure
  if (testId === "empty-state-label") {
    return (
      <div
        data-testid={testId}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        className="w-full flex items-center justify-center m-0"
      >
        <div className="w-full h-full">{content}</div>
      </div>
    );
  }

  // For all other states
  return content;
};

// Storage provider icons component
const StorageProviderIcons = ({ t }: { t?: (k: string) => string }) => {
  const _t = t ?? ((k: string) => k);
  return (
  <div className="flex items-center justify-center gap-base mb-wide" data-testid="dm-storage-provider-icons">
    <Tooltip title={_t("storage.amazonS3")}>
      <div className="flex items-center justify-center p-2" aria-label={_t("storage.amazonS3")}>
        <IconCloudProviderS3 width={32} height={32} className="text-neutral-content-subtler" />
      </div>
    </Tooltip>
    <Tooltip title={_t("storage.googleCloudStorage")}>
      <div className="flex items-center justify-center p-2" aria-label={_t("storage.googleCloudStorage")}>
        <IconCloudProviderGCS width={32} height={32} className="text-neutral-content-subtler" />
      </div>
    </Tooltip>
    <Tooltip title={_t("storage.azureBlobStorage")}>
      <div className="flex items-center justify-center p-2" aria-label={_t("storage.azureBlobStorage")}>
        <IconCloudProviderAzure width={32} height={32} className="text-neutral-content-subtler" />
      </div>
    </Tooltip>
    <Tooltip title={_t("storage.redisStorage")}>
      <div className="flex items-center justify-center p-2" aria-label={_t("storage.redisStorage")}>
        <IconCloudProviderRedis width={32} height={32} className="text-neutral-content-subtler" />
      </div>
    </Tooltip>
  </div>
  );
};

// Documentation link component
const DocumentationLink = ({ t }: { t?: (k: string) => string }) => {
  if (window.APP_SETTINGS?.whitelabel_is_active) {
    return null;
  }
  const _t = t ?? ((k: string) => k);

  return (
    <Typography variant="label" size="small" className="text-primary-link hover:underline">
      <a
        href={getDocsUrl("guide/tasks")}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1"
        data-testid="dm-docs-data-import-link"
      >
        {_t("dataManager.seeDocsOnImporting")}
        <span className="sr-only"> (opens in a new tab)</span>
        <IconExternal width={20} height={20} />
      </a>
    </Typography>
  );
};

/**
 * Unified empty state for Data Manager
 * Handles different empty states based on user role and context
 *
 * Props:
 * - canImport: boolean — whether import is enabled in interfaces
 * - onOpenSourceStorageModal: () => void — opens Connect Source Storage modal
 * - onOpenImportModal: () => void — opens Import modal
 * - userRole: string — User role (REVIEWER, ANNOTATOR, etc.) - optional
 * - project: object — Project object with assignment settings - optional
 * - hasData: boolean — Whether the project has any tasks - optional
 * - hasFilters: boolean — Whether filters are currently applied - optional
 * - canLabel: boolean — Whether the Label All Tasks button would be enabled - optional
 * - onLabelAllTasks: function — Callback for Label All Tasks action - optional
 * - onClearFilters: function — Callback to clear all applied filters - optional
 */

export const EmptyState: FC<EmptyStateProps> = ({
  t: tProp,
  canImport,
  onOpenSourceStorageModal,
  onOpenImportModal,
  // Role-based props (optional)
  userRole,
  project,
  hasData: _hasData,
  hasFilters,
  canLabel: _canLabel,
  onLabelAllTasks,
  onClearFilters,
}) => {
  const _t = tProp ?? ((k: string) => k);
  const isImportEnabled = Boolean(canImport);
  const { permissions } = useAuth();

  // If filters are applied, show the filter-specific empty state (regardless of user role)
  if (hasFilters) {
    return renderEmptyStateLayout({
      icon: <IconSearch />,
      iconBackground: "bg-warning-background",
      iconColor: "text-warning-icon",
      title: _t("dataManager.noTasksFound"),
      description: _t("dataManager.tryAdjustingFilters"),
      actions: (
        <Button variant="primary" look="outlined" onClick={onClearFilters} data-testid="dm-clear-filters-button">
          {_t("dataManager.clearFilters")}
        </Button>
      ),
    });
  }

  // Role-based empty state logic (from RoleBasedEmptyState)
  // For service roles (reviewers/annotators), show role-specific empty states when they have no visible tasks
  // This applies whether the project has tasks or not - what matters is what's visible to this user
  if (userRole === "REVIEWER" || userRole === "ANNOTATOR") {
    // Reviewer empty state
    if (userRole === "REVIEWER") {
      return renderEmptyStateLayout({
        icon: <IconCheck />,
        title: _t("dataManager.noTasksForReview"),
        description: _t("dataManager.tasksImportedWillAppear"),
      });
    }

    // Annotator empty state
    if (userRole === "ANNOTATOR") {
      const isAutoDistribution = project?.assignment_settings?.label_stream_task_distribution === "auto_distribution";
      const isManualDistribution = project?.assignment_settings?.label_stream_task_distribution === "assigned_only";

      if (isAutoDistribution) {
        return renderEmptyStateLayout({
          icon: <IconLsLabeling />,
          title: _t("dataManager.startLabelingTasks"),
          description: _t("dataManager.tasksLabeledWillAppear"),
          actions: (
            <Button
              variant="primary"
              look="filled"
              disabled={false}
              onClick={onLabelAllTasks}
              data-testid="dm-label-all-tasks-button"
            >
              {_t("dataManager.labelAllTasks")}
            </Button>
          ),
        });
      }

      if (isManualDistribution) {
        return renderEmptyStateLayout({
          icon: <IconInbox />,
          title: _t("dataManager.noTasksAvailable"),
          description: _t("dataManager.tasksAssignedWillAppear"),
        });
      }

      // Fallback for annotators with unknown distribution setting
      return renderEmptyStateLayout({
        icon: <IconInbox width={40} height={40} />,
        title: _t("dataManager.noTasksAvailable"),
        description: _t("dataManager.tasksWillAppearWhenAvailable"),
      });
    }
  }

  // Default case: show import functionality (existing behavior for Owners/Admins/Managers)
  return renderEmptyStateLayout({
    icon: <IconUpload />,
    title: _t("dataManager.importDataToGetStarted"),
    description: _t("dataManager.connectStorageOrUpload"),
    testId: "empty-state-label",
    ariaLabelledBy: "dm-empty-title",
    ariaDescribedBy: "dm-empty-desc",
    additionalContent: <StorageProviderIcons t={_t} />,
    actions: (
      <>
        {permissions.can(ABILITY.can_manage_storage) && (
          <Button
            variant="primary"
            look="filled"
            className="flex-1"
            onClick={onOpenSourceStorageModal}
            data-testid="dm-connect-source-storage-button"
          >
            {_t("dataManager.connectCloudStorage")}
          </Button>
        )}

        {isImportEnabled && (
          <Button
            variant="primary"
            look="outlined"
            className="flex-1"
            onClick={onOpenImportModal}
            data-testid="dm-import-button"
          >
            {_t("dataManager.import")}
          </Button>
        )}
      </>
    ),
    footer: <DocumentationLink t={_t} />,
  });
};
