import type { ReactNode } from "react";
import { TONE_CLASSES, type Tone } from "../../lib/constants";

type Props = {
  children: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  size?: "xs" | "sm";
  className?: string;
  dot?: boolean;
};

export default function Badge({
  children,
  tone = "slate",
  icon,
  size = "sm",
  className = "",
  dot = false,
}: Props) {
  const sizes = size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ring-1 ring-inset ${TONE_CLASSES[tone]} ${sizes} ${className}`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {icon}
      {children}
    </span>
  );
}
