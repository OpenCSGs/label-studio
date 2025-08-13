import type { FC } from "react";
import { getType } from "mobx-state-tree";
import { observer } from "mobx-react";
import { ApartmentOutlined, AudioOutlined, LineChartOutlined, MessageOutlined } from "@ant-design/icons";

import { NodeView } from "./NodeView";
import "./Node.scss";
import {
  IconBrushTool,
  IconBrushToolSmart,
  IconCircleTool,
  IconCircleToolSmart,
  IconKeypointsTool,
  IconKeypointsToolSmart,
  IconPolygonTool,
  IconPolygonToolSmart,
  IconRectangle3PointTool,
  IconRectangle3PointToolSmart,
  IconRectangleTool,
  IconRectangleToolSmart,
  IconText,
  IconTimelineRegion,
} from "@humansignal/icons";

const NodeViews = {
  // fake view for virtual node representing label group
  LabelModel: {
    icon: () => null,
  },

  RichTextRegionModel: {
    name: "HTML",
    icon: IconText,
    getContent: (node: any) => <span style={{ color: "#5a5a5a" }}>{node.text}</span>,
    fullContent: (node: any) => (
      <div>
        {/* <div style={{ color: "#5a5a5a" }}>{node.text}</div> */}
        <div>{node.start}</div>
        <div>{node.startOffset}</div>
        <div>{JSON.stringify(node.globalOffsets, null, 2)}</div>
      </div>
    ),
  },

  ParagraphsRegionModel: NodeView({
    name: "Paragraphs",
    icon: IconText,
    getContent: (node) => <span style={{ color: "#5a5a5a" }}>{node.text}</span>,
  }),

  AudioRegionModel: NodeView({
    name: "Audio",
    icon: AudioOutlined,
  }),

  TimeSeriesRegionModel: NodeView({
    name: "TimeSeries",
    icon: LineChartOutlined,
  }),

  TextAreaRegionModel: NodeView({
    name: "Input",
    icon: MessageOutlined,
    getContent: (node) => <span style={{ color: "#5a5a5a" }}>{node._value}</span>,
  }),

  RectRegionModel: NodeView({
    name: "Rect",
    icon: IconRectangleTool,
    altIcon: IconRectangleToolSmart,
  }),

  Rect3PointRegionModel: NodeView({
    name: "Rect3Point",
    icon: IconRectangle3PointTool,
    altIcon: IconRectangle3PointToolSmart,
  }),

  VideoRectangleRegionModel: NodeView({
    name: "Video Rect",
    icon: IconRectangleTool,
    altIcon: IconRectangleToolSmart,
    getContent: (node) => <span style={{ color: "#5a5a5a" }}>from {node.sequence[0]?.frame} frame</span>,
  }),

  PolygonRegionModel: NodeView({
    name: "Polygon",
    icon: IconPolygonTool,
    altIcon: IconPolygonToolSmart,
  }),

  EllipseRegionModel: NodeView({
    name: "Ellipse",
    icon: IconCircleTool,
    altIcon: IconCircleToolSmart,
  }),

  // @todo add coords
  KeyPointRegionModel: NodeView({
    name: "KeyPoint",
    icon: IconKeypointsTool,
    altIcon: IconKeypointsToolSmart,
  }),

  BrushRegionModel: NodeView({
    name: "Brush",
    icon: IconBrushTool,
    altIcon: IconBrushToolSmart,
  }),

  BitmaskRegionModel: NodeView({
    name: "Brush",
    icon: IconBrushTool,
    altIcon: IconBrushToolSmart,
  }),

  ChoicesModel: NodeView({
    name: "Classification",
    icon: ApartmentOutlined,
  }),

  TextAreaModel: NodeView({
    name: "Input",
    icon: MessageOutlined,
  }),

  TimelineRegionModel: NodeView({
    name: "Timeline Span",
    icon: IconTimelineRegion,
  }),
};

const NodeIcon: FC<any> = observer(({ node, ...props }) => {
  const name = useNodeName(node);

  if (!(name in NodeViews)) {
    console.error(`No ${name} in NodeView`);
    return null;
  }

  const { icon: Icon } = NodeViews[name];

  return <Icon {...props} />;
});

const useNodeName = (node: any) => {
  // @todo sometimes node is control tag, not a region
  // @todo and for new taxonomy it can be plain object
  if (!node.$treenode) return null;
  return getType(node).name as keyof typeof NodeViews;
};

export { NodeIcon, NodeViews };
