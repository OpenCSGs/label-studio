import type { Meta, StoryObj } from "@storybook/react";
import { Typography } from "./typography";

// Define a more specific type for the stories
type TypographyStory = StoryObj<{
  variant: "display" | "headline" | "title" | "label" | "body";
  size: string;
  fontStyle?: "normal" | "italic";
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  children: React.ReactNode;
}>;

const meta: Meta<typeof Typography> = {
  title: "UI/Typography",
  component: Typography,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: "A flexible typography component that provides consistent text styling across the application.",
      },
    },
  },
  argTypes: {
    variant: {
      control: { type: "select" },
      options: ["display", "headline", "title", "label", "body"],
      description: "The typography variant to use",
    },
    size: {
      control: { type: "select" },
      description: "The size variant for the selected typography variant",
    },
    fontStyle: {
      control: { type: "select" },
      options: ["normal", "italic"],
      description: "The text style to apply",
    },
    as: {
      control: { type: "text" },
      description: "Override the default HTML element",
    },
    className: {
      control: { type: "text" },
      description: "Additional CSS classes to apply",
    },
  },
  tags: ["autodocs"],
};

export default meta;

// Base story with controls
export const Default: TypographyStory = {
  args: {
    variant: "body",
    size: "medium",
    children: "This is a sample body",
  },
};

// All variants comparison
export const AllVariants: TypographyStory = {
  args: {
    variant: "display",
    size: "large",
    children: "Display Large",
  },
  render: () => (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-4 !text-neutral-content-subtle">Display Variants</h3>
        <div className="space-y-2">
          <Typography variant="display" size="large">
            Display Large
          </Typography>
          <Typography variant="display" size="medium">
            Display Medium
          </Typography>
          <Typography variant="display" size="small">
            Display Small
          </Typography>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4 !text-neutral-content-subtle">Headline Variants</h3>
        <div className="space-y-2">
          <Typography variant="headline" size="large">
            Headline Large
          </Typography>
          <Typography variant="headline" size="medium">
            Headline Medium
          </Typography>
          <Typography variant="headline" size="small">
            Headline Small
          </Typography>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4 !text-neutral-content-subtle">Title Variants</h3>
        <div className="space-y-2">
          <Typography variant="title" size="large">
            Title Large
          </Typography>
          <Typography variant="title" size="medium">
            Title Medium
          </Typography>
          <Typography variant="title" size="small">
            Title Small
          </Typography>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4 !text-neutral-content-subtle">Label Variants</h3>
        <div className="space-y-2">
          <Typography variant="label" size="medium">
            Label Medium
          </Typography>
          <Typography variant="label" size="small">
            Label Small
          </Typography>
          <Typography variant="label" size="smaller">
            Label Smaller
          </Typography>
          <Typography variant="label" size="smallest">
            Label Smallest
          </Typography>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4 !text-neutral-content-subtle">Body Variants</h3>
        <div className="space-y-2">
          <Typography variant="body" size="medium">
            Body Medium
          </Typography>
          <Typography variant="body" size="small">
            Body Small
          </Typography>
          <Typography variant="body" size="smaller">
            Body Smaller
          </Typography>
          <Typography variant="body" size="smallest">
            Body Smallest
          </Typography>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "A comprehensive view of all typography variants and their sizes for easy comparison.",
      },
    },
  },
};

// Style variations
export const FontStyles: TypographyStory = {
  args: {
    variant: "headline",
    size: "large",
    fontStyle: "normal",
    children: "Normal Style - The quick brown fox jumps over the lazy dog",
  },
  render: () => (
    <div className="space-y-4">
      <Typography variant="headline" size="large" fontStyle="normal">
        Normal Style - The quick brown fox jumps over the lazy dog
      </Typography>
      <Typography variant="headline" size="large" fontStyle="italic">
        Italic Style - The quick brown fox jumps over the lazy dog
      </Typography>
      <Typography variant="body" size="medium" fontStyle="normal">
        Normal body text - The quick brown fox jumps over the lazy dog
      </Typography>
      <Typography variant="body" size="medium" fontStyle="italic">
        Italic body text - The quick brown fox jumps over the lazy dog
      </Typography>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Typography component supports both normal and italic text styles.",
      },
    },
  },
};

// Custom elements
export const CustomElements: TypographyStory = {
  args: {
    variant: "headline",
    size: "large",
    as: "h1",
    children: "This renders as an H1 element",
  },
  render: () => (
    <div className="space-y-4">
      <Typography variant="headline" size="large" as="h1">
        This renders as an H1 element
      </Typography>
      <Typography variant="title" size="medium" as="h2">
        This renders as an H2 element
      </Typography>
      <Typography variant="body" size="medium" as="span">
        This renders as a span element
      </Typography>
      <Typography variant="label" size="small" as="label">
        This renders as a label element
      </Typography>
      <Typography variant="body" size="small" as="div">
        This renders as a div element
      </Typography>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Use the `as` prop to override the default HTML element while maintaining the typography styles.",
      },
    },
  },
};

// Color variations
export const Colors: TypographyStory = {
  args: {
    variant: "body",
    size: "medium",
    children: "This text demonstrates different neutral content colors",
  },
  render: () => (
    <div className="space-y-4">
      <Typography variant="headline" size="medium" className="text-neutral-content">
        Default Color - Primary content with full contrast
      </Typography>
      <Typography variant="body" size="medium" className="text-neutral-content-subtle">
        Subtle Color - Secondary content with reduced contrast
      </Typography>
      <Typography variant="body" size="medium" className="text-neutral-content-subtler">
        Subtler Color - Tertiary content with further reduced contrast
      </Typography>
      <Typography variant="body" size="medium" className="text-neutral-content-subtlest">
        Subtlest Color - Quaternary content with minimal contrast
      </Typography>
      <Typography variant="body" size="medium" className="text-negative-content">
        Negative Color - Negative content with full contrast
      </Typography>
      <Typography variant="body" size="medium" className="text-primary-content">
        Primary content color (text-primary-content) - overrides default neutral
      </Typography>
      <Typography variant="body" size="medium" className="text-positive-content">
        Positive content color (text-positive-content) - overrides default neutral
      </Typography>
      <Typography variant="body" size="medium" className="text-accent-grape-dark">
        Accent grape dark color (text-accent-grape-dark) - overrides default neutral
      </Typography>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Typography component supports different neutral content colors for creating visual hierarchy and emphasis. The component also automatically detects text color classes in the className prop and prevents the default text-neutral-content from overriding them, allowing custom colors to work properly.",
      },
    },
  },
};

// Composition example
export const Composition: TypographyStory = {
  args: {
    variant: "headline",
    size: "medium",
    children: "Composition Example",
  },
  render: () => (
    <div className="space-y-6">
      <div className="p-4 border rounded-lg">
        <Typography variant="headline" size="medium" className="mb-2">
          Composition Example
        </Typography>
        <Typography variant="body" size="medium" className="mb-4">
          This example shows how <strong>typography components</strong> can be used together. You can customize the
          variant, size, and style using the controls below.
        </Typography>
        <Typography variant="label" size="small" fontStyle="italic" className="text-neutral-content-subtle">
          Use the Storybook controls to experiment with different typography options.
        </Typography>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "A composition example showing how typography components work together in a real-world context.",
      },
    },
  },
};
