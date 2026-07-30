import Link from "next/link";
import type { Quest } from "@/domain/quest";
import { bottleneckIndex } from "@/domain/metrics";
import { ChangeValue } from "./ChangeValue";

// 캔들차트는 과제 데이터에 시가/고가/저가/종가에 대응하는 의미가 없어 쓰지 않는다(brief 7항).
// 대신 실제 상태분포(미진행/진행중/평가대기/완료)를 막대 하나로 압축해 "지금 이 과제가 어떤 상태인지"를 보여준다.
export function QuestTicker({ quest, label }: { quest: Quest; label: string }) {
  const total = quest.states.notStarted + quest.states.inProgress + quest.states.evalWaiting + quest.states.completed;
  const bottleneck = bottleneckIndex(quest);
  const segments = [
    { key: "notStarted", value: quest.states.notStarted, className: "bg-neutral-200 dark:bg-neutral-700" },
    { key: "inProgress", value: quest.states.inProgress, className: "bg-blue-400" },
    { key: "evalWaiting", value: quest.states.evalWaiting, className: "bg-amber-400" },
    { key: "completed", value: quest.states.completed, className: "bg-emerald-500" },
  ];

  return (
    <Link
      href={`/quests/${quest.id}`}
      className="block rounded-sm border border-border bg-surface p-4 shadow-sm hover:border-neutral-400 dark:hover:border-neutral-600"
    >
      <div className="text-[10px] uppercase tracking-wide text-neutral-400 dark:text-neutral-500">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">{quest.name}</div>
      <div className="mt-0.5 truncate text-xs text-neutral-500 dark:text-neutral-400">{quest.track}</div>

      <div className="mt-3 flex h-2 overflow-hidden rounded-[2px]">
        {segments.map((s) => (
          <div key={s.key} className={s.className} style={{ width: `${total > 0 ? (s.value / total) * 100 : 0}%` }} />
        ))}
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        <div>
          <span className="text-lg font-semibold tabular-nums dark:text-neutral-100">{bottleneck}</span>
          <span className="ml-1 text-[10px] text-neutral-400 dark:text-neutral-500">병목지수</span>
        </div>
        <ChangeValue pct={quest.recentChangePct} />
      </div>
    </Link>
  );
}
