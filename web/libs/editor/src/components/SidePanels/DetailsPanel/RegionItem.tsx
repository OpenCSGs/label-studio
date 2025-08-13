import chroma from "chroma-js";
import { observer } from "mobx-react";
import { type FC, forwardRef, useMemo, useState } from "react";
import { IconRelationLink, IconPlus, IconTrash, IconWarning, IconEyeClosed, IconEyeOpened } from "@humansignal/icons";
import { Button, type ButtonProps } from "@humansignal/ui";
import { CREATE_RELATION_MODE } from "../../../stores/Annotation/LinkingModes";
import { Block, Elem } from "../../../utils/bem";
import { NodeIcon } from "../../Node/Node";
import { LockButton } from "../Components/LockButton";
import { RegionLabels } from "./RegionLabels";
import { WithHotkey } from "../../../common/Hotkey/WithHotkey";

interface RegionItemProps {
  region: any;
  withActions?: boolean;
  compact?: boolean;
  withIds?: boolean;
  mainDetails?: FC<{ region: any }>;
  metaDetails?: FC<{ region: any; editMode?: boolean; cancelEditMode?: () => void; enterEditMode: () => void }>;
}

export const RegionItem: FC<RegionItemProps> = observer(
  ({
    region,
    compact = false,
    withActions = true,
    withIds = true,
    mainDetails: MainDetails,
    metaDetails: MetaDetails,
  }) => {
    const { annotation } = region;
    const { selectedRegions: nodes } = annotation;
    const [editMode, setEditMode] = useState(false);

    const hasEditableRegions = useMemo(() => {
      return !!nodes.find((node: any) => !node.isReadOnly() && !node.classification);
    }, [nodes]);

    const color = useMemo(() => {
      const bgColor = region.background ?? region.getOneColor() ?? "#666";

      return chroma(bgColor).alpha(1);
    }, [region.background, region.style]);

    return (
      <Block name="detailed-region" mod={{ compact }} data-testid="detailed-region">
        <Elem name="head" style={{ color: color.css() }}>
          <Elem name="title">
            <Elem name="icon">
              <NodeIcon node={region} />
            </Elem>
            <Elem name="index">
              <Elem tag="span" name="index_value">
                {region.region_index}
              </Elem>
            </Elem>
            <RegionLabels region={region} />
          </Elem>
          {withIds && <span>{region.cleanId}</span>}
        </Elem>
        {MainDetails && (
          <Elem name="content">
            <MainDetails region={region} />
          </Elem>
        )}
        {region.isDrawing && (
          <Elem name="warning">
            <IconWarning />
            <Elem name="warning-text">Incomplete {region.type?.replace("region", "") ?? "region"}</Elem>
          </Elem>
        )}
        {withActions && (
          <RegionAction
            region={region}
            editMode={editMode}
            annotation={annotation}
            hasEditableRegions={hasEditableRegions}
            onEditModeChange={setEditMode}
          />
        )}
        {MetaDetails && (
          <Elem name="content">
            <MetaDetails
              region={region}
              editMode={editMode}
              enterEditMode={() => setEditMode(true)}
              cancelEditMode={() => setEditMode(false)}
            />
          </Elem>
        )}
      </Block>
    );
  },
);

const RegionAction: FC<any> = observer(({ region, annotation, editMode, onEditModeChange }) => {
  const entityButtons: JSX.Element[] = [];

  entityButtons.push(
    <WithHotkey binging="region:relation">
      <RegionActionButton
        key="relation"
        variant={annotation.isLinkingMode ? "primary" : "neutral"}
        look={annotation.isLinkingMode ? "filled" : "string"}
        onClick={(_e: any, hotkey?: any) => {
          // If this is triggered by a hotkey, defer to the global bound handler for relations to avoid contention.
          if (hotkey) return;
          if (annotation.isLinkingMode) {
            annotation.stopLinkingMode();
          } else {
            annotation.startLinkingMode(CREATE_RELATION_MODE, region);
          }
        }}
        aria-label="Create Relation"
      >
        <IconRelationLink />
      </RegionActionButton>
    </WithHotkey>,
  );

  entityButtons.push(
    <WithHotkey binging="region:meta">
      <RegionActionButton
        key="meta"
        look={editMode ? "filled" : "string"}
        variant={editMode ? "primary" : "neutral"}
        onClick={() => onEditModeChange(!editMode)}
        aria-label="Edit region's meta"
      >
        <IconPlus />
      </RegionActionButton>
    </WithHotkey>,
  );

  return (
    <Block name="region-actions">
      <Elem name="group" mod={{ align: "left" }}>
        {!region.isReadOnly() && entityButtons}
      </Elem>
      <Elem name="group" mod={{ align: "right" }}>
        <LockButton
          item={region}
          annotation={region?.annotation}
          hovered={true}
          locked={region?.locked}
          onClick={() => region.setLocked(!region.locked)}
          displayedHotkey="region:lock"
          look="string"
          style={{ width: 36, height: 32 }}
        />
        <RegionActionButton
          aria-label={`${region.hidden ? "Show" : "Hide"} selected region`}
          onClick={region.toggleHidden}
        >
          {region.hidden ? <IconEyeClosed /> : <IconEyeOpened />}
        </RegionActionButton>
        <RegionActionButton
          variant="negative"
          aria-label="Delete selected region"
          disabled={region.isReadOnly()}
          onClick={() => annotation.deleteRegion(region)}
        >
          <IconTrash />
        </RegionActionButton>
      </Elem>
    </Block>
  );
});

const RegionActionButton: FC<ButtonProps> = forwardRef(({ children, ...props }, ref) => {
  return (
    <Button ref={ref} variant="neutral" look="string" size="small" {...props}>
      {children}
    </Button>
  );
});
