// 요일별 수요 vs 공급 막대 — 홈(주간 요약)과 평가 시장(상세) 양쪽에서 재사용.
export function WeekdaySupplyDemandBars({
  weekly,
}: {
  weekly: { label: string; demand: number; supply: number }[];
}) {
  const max = Math.max(...weekly.map((w) => Math.max(w.demand, w.supply)), 1);

  return (
    <div>
      <div className="space-y-3">
        {weekly.map((w) => (
          <div key={w.label} className="grid grid-cols-[2rem_1fr] items-center gap-3 text-xs">
            <span className="text-neutral-500 dark:text-neutral-400">{w.label}</span>
            <div className="space-y-1">
              <Bar label="수요" value={w.demand} max={max} colorClass="bg-red-600" />
              <Bar label="공급" value={w.supply} max={max} colorClass="bg-blue-600" />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-4 text-[11px] text-neutral-500 dark:text-neutral-400">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-[1px] bg-red-600" /> 수요(평가 요청)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-[1px] bg-blue-600" /> 공급(완료 처리)
        </span>
      </div>
    </div>
  );
}

function Bar({ label, value, max, colorClass }: { label: string; value: number; max: number; colorClass: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 text-[10px] text-neutral-400 dark:text-neutral-500">{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-[2px] bg-neutral-100 dark:bg-neutral-800">
        <div className={`h-full ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right text-[10px] tabular-nums text-neutral-500 dark:text-neutral-400">{value}</span>
    </div>
  );
}
