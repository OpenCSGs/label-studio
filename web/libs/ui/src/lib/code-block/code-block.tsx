import { cnm } from "@humansignal/ui";

export function CodeBlock({
  code,
  className,
  variant = "default",
}: {
  title?: string;
  description?: string;
  code: string;
  className?: string;
  variant?: "default" | "warning" | "negative";
}) {
  const variantStyles = {
    default: "bg-neutral-surface border-neutral-border",
    warning: "bg-warning-background border-warning-border-subtle",
    negative: "bg-negative-background border-negative-border-subtle",
  };

  return (
    <div
      className={cnm(
        "p-3 rounded-small border scrollbar-thin scrollbar-thumb-neutral-border-bold scrollbar-track-transparent",
        variantStyles[variant],
        className,
      )}
    >
      <pre className="whitespace-pre-wrap">{code.trim()}</pre>
    </div>
  );
}
