import type React from "react";
import { forwardRef } from "react";
import { cnm } from "../../utils/utils";
import styles from "./typography.module.scss";

// Size constants
const SIZES = {
  LARGE: "large",
  MEDIUM: "medium",
  SMALL: "small",
  SMALLER: "smaller",
  SMALLEST: "smallest",
} as const;

type Sizes = {
  display: typeof SIZES.LARGE | typeof SIZES.MEDIUM | typeof SIZES.SMALL;
  headline: typeof SIZES.LARGE | typeof SIZES.MEDIUM | typeof SIZES.SMALL;
  title: typeof SIZES.LARGE | typeof SIZES.MEDIUM | typeof SIZES.SMALL;
  label: typeof SIZES.MEDIUM | typeof SIZES.SMALL | typeof SIZES.SMALLER | typeof SIZES.SMALLEST;
  body: typeof SIZES.MEDIUM | typeof SIZES.SMALL | typeof SIZES.SMALLER | typeof SIZES.SMALLEST;
};

type Variant = keyof Sizes;

const config = {
  display: {
    tag: { [SIZES.LARGE]: "h1", [SIZES.MEDIUM]: "h1", [SIZES.SMALL]: "h1" },
  },
  headline: {
    tag: { [SIZES.LARGE]: "h2", [SIZES.MEDIUM]: "h2", [SIZES.SMALL]: "h2" },
  },
  title: {
    tag: { [SIZES.LARGE]: "h3", [SIZES.MEDIUM]: "h4", [SIZES.SMALL]: "h5" },
  },
  label: {
    tag: { [SIZES.MEDIUM]: "p", [SIZES.SMALL]: "p", [SIZES.SMALLER]: "p", [SIZES.SMALLEST]: "p" },
  },
  body: {
    tag: { [SIZES.MEDIUM]: "p", [SIZES.SMALL]: "p", [SIZES.SMALLER]: "p", [SIZES.SMALLEST]: "p" },
  },
} as const satisfies {
  [V in Variant]: {
    tag: Record<Sizes[V], keyof JSX.IntrinsicElements>;
  };
};

type TypographyProps<V extends Variant = Variant> = {
  variant?: V;
  size?: Sizes[V];
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  fontStyle?: "normal" | "italic";
  style?: React.CSSProperties;
  children: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLElement>, "style" | "className" | "children">;

const DEFAULT_TAG = "p";
const DEFAULT_CLASS = "typography-body-medium";

const Typography = forwardRef<HTMLElement, TypographyProps>(
  ({ variant = "body", size = SIZES.MEDIUM, as, className, children, fontStyle = "normal", style, ...rest }, ref) => {
    const variantConfig = config[variant];
    const tagMap = variantConfig?.tag;
    const tag = tagMap && size in tagMap ? tagMap[size as keyof typeof tagMap] : DEFAULT_TAG;
    const isValid = variant in config && tagMap && size in tagMap;
    const baseClass = isValid ? `typography-${variant}-${size}` : DEFAULT_CLASS;
    const Tag = (as || tag) as React.ElementType;

    return (
      <Tag
        ref={ref}
        className={cnm(styles[baseClass], fontStyle === "italic" && "italic", className)}
        style={style}
        {...rest}
      >
        {children}
      </Tag>
    );
  },
);

Typography.displayName = "Typography";

export { Typography, SIZES };
