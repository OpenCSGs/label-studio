import { forwardRef, type FC } from "react";
import { Button, type ButtonProps } from "@humansignal/ui";
import { WithHotkey } from "../../../common/Hotkey/WithHotkey";
import type { HotkeyList } from "libs/editor/src/core/Hotkey";

export const RegionControlButton: FC<
  ButtonProps & {
    hotkey: HotkeyList;
  }
> = forwardRef(({ children, onClick, hotkey, ...props }, ref) => {
  return (
    <WithHotkey binging={hotkey}>
      <Button
        {...props}
        ref={ref}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.(e);
        }}
        look="string"
        size="smaller"
        style={{ ...(props.style ?? {}) }}
        aria-label={typeof children === "string" ? children : "Region control"}
      >
        {children}
      </Button>
    </WithHotkey>
  );
});
