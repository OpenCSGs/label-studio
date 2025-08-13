import { forwardRef } from "react";
import { observer } from "mobx-react";
import { IconBan, IconSparks, IconStar } from "@humansignal/icons";
import { Userpic } from "@humansignal/ui";
import { Space } from "../../common/Space/Space";
import { Block, Elem } from "../../utils/bem";
import "./AnnotationTabs.scss";

export const EntityTab = observer(
  forwardRef(
    ({ entity, selected, style, onClick, bordered = true, prediction = false, displayGroundTruth = false }, ref) => {
      const isUnsaved = (entity.userGenerate && !entity.sentUserGenerate) || entity.draftSelected;
      const infoIsHidden = entity.store.hasInterface("annotations:hide-info");

      return (
        <Block
          name="entity-tab"
          ref={ref}
          mod={{ selected, bordered }}
          style={style}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClick?.(entity, prediction);
          }}
        >
          <Space size="small">
            <Elem
              name="userpic"
              tag={Userpic}
              showUsername
              username={prediction ? entity.createdBy : null}
              user={infoIsHidden ? {} : (entity.user ?? { email: entity.createdBy })}
              mod={{ prediction }}
            >
              {prediction && <IconSparks style={{ width: 16, height: 16 }} />}
            </Elem>

            {!infoIsHidden && (
              <Elem name="identifier">
                ID {entity.pk ?? entity.id} {isUnsaved && "*"}
              </Elem>
            )}

            {displayGroundTruth && entity.ground_truth && <Elem name="ground-truth" tag={IconStar} />}

            {entity.skipped && <Elem name="skipped" tag={IconBan} />}
          </Space>
        </Block>
      );
    },
  ),
);
