import { ff } from "@humansignal/core";
import { getEnv, getRoot, types } from "mobx-state-tree";
import { cloneNode } from "../core/Helpers";
import { FF_DEV_3391 } from "../utils/feature-flags";
import { AnnotationMixin } from "./AnnotationMixin";

const ToolMixin = types
  .model({
    selected: types.optional(types.boolean, false),
    group: types.optional(types.string, "default"),
    shortcut: types.optional(types.maybeNull(types.string), null),
  })
  .views((self) => ({
    get obj() {
      if (ff.isActive(FF_DEV_3391)) {
        // It's a temporal solution (see root description)
        const root = self.manager?.root;
        if (root?.annotationStore.selected) {
          return root.annotationStore.selected.names.get(self.manager?.name);
        }
      }
      return self.manager?.obj ?? getEnv(self).object;
    },

    get manager() {
      return getEnv(self).manager;
    },

    get control() {
      if (ff.isActive(FF_DEV_3391)) {
        // It's a temporal solution (see root description)
        const control = getEnv(self).control;
        const { name } = control;
        const root = self.manager?.root;
        if (root?.annotationStore.selected) {
          return root.annotationStore.selected.names.get(name);
        }
        return control;
      }
      return getEnv(self).control;
    },

    get viewClass() {
      return () => null;
    },

    get fullName() {
      return self.toolName + (self.dynamic ? "-dynamic" : "");
    },

    get clonedStates() {
      const states = [self.control];
      const activeStates = states
        ? states.filter((c) => c.isSelected)
        : // .filter(
          //   c =>
          //     c.type === IMAGE_CONSTANTS.rectanglelabels ||
          //     c.type === IMAGE_CONSTANTS.keypointlabels ||
          //     c.type === IMAGE_CONSTANTS.polygonlabels ||
          //     c.type === IMAGE_CONSTANTS.brushlabels,
          // )
          null;

      return activeStates ? activeStates.map((s) => cloneNode(s)) : null;
    },

    get getActiveShape() {
      // active shape here is the last one that was added
      const obj = self.obj;

      return obj.regs[obj.regs.length - 1];
    },

    get getSelectedShape() {
      return self.control.annotation.highlightedNode;
    },

    get extraShortcuts() {
      return {};
    },

    get shouldPreserveSelectedState() {
      if (!self.obj) return false;

      const settings = getRoot(self.obj).settings;

      return settings.preserveSelectedTool;
    },

    get isPreserved() {
      return window.localStorage.getItem(`selected-tool:${self.obj?.name}`) === self.fullName;
    },
  }))
  .actions((self) => ({
    setSelected(selected, isInitial) {
      self.selected = selected;
      self.afterUpdateSelected();

      if (!isInitial && selected && self.obj) {
        const storeName = `selected-tool:${self.obj.name}`;

        if (self.shouldPreserveSelectedState) {
          window.localStorage.setItem(storeName, self.fullName);
        }
      }
    },

    afterUpdateSelected() {},

    event(name, ev, args) {
      const fn = `${name}Ev`;

      if (typeof self[fn] !== "undefined") self[fn].call(self, ev, args);
    },

    /**
     * Indicates will the tool interact with the regions or not
     * It doesn't affect interactions with the canvas (zooming, drawing, etc.)
     * Some tools might override this method (at least MoveTool and ZoomTool)
     * @param e
     * @returns {boolean}
     */
    shouldSkipInteractions(e) {
      const isCtrlPressed = e.evt && (e.evt.metaKey || e.evt.ctrlKey);
      const hasSelection = self.control.annotation.hasSelection;

      return !!isCtrlPressed && !hasSelection;
    },
  }));

export default types.compose(ToolMixin, AnnotationMixin);
