import type { Confidence } from "@/domain/quest";
import { CONFIDENCE_LABEL } from "@/domain/quest";

const STYLE: Record<Confidence, string> = {
  confirmed_api: "bg-emerald-50 text-emerald-700 border-emerald-200",
  confirmed_ui: "bg-emerald-50 text-emerald-700 border-emerald-200",
  observed: "bg-amber-50 text-amber-700 border-amber-200",
  inferred: "bg-violet-50 text-violet-700 border-violet-200",
  unknown: "bg-neutral-100 text-neutral-500 border-neutral-200",
};

export function ConfidenceBadge({ level }: { level: Confidence }) {
  return (
    <span
      className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] leading-none ${STYLE[level]}`}
    >
      {CONFIDENCE_LABEL[level]}
    </span>
  );
}
