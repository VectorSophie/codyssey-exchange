import { Fragment } from "react";
import { realEvalAggregate } from "@/data/real-eval-aggregate";
import { buildHeatCells, maxAbsGap, weekdayTotals } from "@/domain/evaluation";

export default function EvalMarketPage() {
  const agg = realEvalAggregate;
  const cells = buildHeatCells(agg);
  const maxGap = maxAbsGap(cells);
  const weekly = weekdayTotals(agg);
  const maxWeekly = Math.max(...weekly.map((w) => Math.max(w.demand, w.supply)));

  function cellStyle(gap: number) {
    if (gap <= 0) {
      const intensity = Math.min(Math.abs(gap) / maxGap, 1);
      return { backgroundColor: `rgba(16,185,129,${0.08 + intensity * 0.35})` }; // 여유 = 초록
    }
    const intensity = Math.min(gap / maxGap, 1);
    return { backgroundColor: `rgba(217,119,6,${0.1 + intensity * 0.55})` }; // 부족 = 주황
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-lg font-semibold">평가 시장</h1>
      <p className="mt-1 text-sm text-neutral-500">
        실제 데이터 · {agg.source} · 집계 {agg.generatedAt.slice(0, 10)}
      </p>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="전체 이벤트" value={agg.totalEvents.toLocaleString()} />
        <Stat label="완료" value={agg.totalCompleted.toLocaleString()} />
        <Stat label="요청 대기" value={agg.totalRequested.toLocaleString()} />
        <Stat
          label="취소/거절율"
          value={`${((agg.totalCancelled / agg.totalEvents) * 100).toFixed(1)}%`}
        />
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-neutral-700">시간대 × 요일 수급 히트맵</h2>
        <p className="mt-1 text-xs text-neutral-500">
          주황 = 수요(평가 요청)가 공급(완료 처리)보다 많은 시간대 · 초록 = 공급이 수요보다 여유 있는 시간대.
          공급 자체를 직접 반환하는 API가 없어 완료 처리량을 공급 근사치로 사용한다(관측 기반, 확정 아님).
        </p>
        <div className="mt-3 overflow-x-auto rounded-sm border border-border bg-surface p-4 shadow-sm">
          <div className="grid min-w-[820px] grid-cols-[2.5rem_repeat(24,1fr)] gap-[2px] text-[10px]">
            <div />
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="text-center text-neutral-400">
                {h % 3 === 0 ? h : ""}
              </div>
            ))}
            {agg.dayLabels.map((label, d) => (
              <Fragment key={`row-${d}`}>
                <div className="flex items-center text-neutral-500">{label}</div>
                {Array.from({ length: 24 }, (_, h) => {
                  const cell = cells.find((c) => c.day === d && c.hour === h)!;
                  return (
                    <div
                      key={`${d}-${h}`}
                      title={`${label}요일 ${h}시 — 수요 ${cell.demand} / 공급(근사) ${cell.supply}`}
                      style={cellStyle(cell.gap)}
                      className="aspect-square rounded-[2px]"
                    />
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-neutral-700">요일별 수요 vs 공급(근사)</h2>
        <div className="mt-3 rounded-sm border border-border bg-surface p-4 shadow-sm">
          <div className="space-y-3">
            {weekly.map((w) => (
              <div key={w.label} className="grid grid-cols-[2rem_1fr] items-center gap-3 text-xs">
                <span className="text-neutral-500">{w.label}</span>
                <div className="space-y-1">
                  <Bar label="수요" value={w.demand} max={maxWeekly} colorClass="bg-neutral-800" />
                  <Bar label="공급" value={w.supply} max={maxWeekly} colorClass="bg-neutral-300" />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-4 text-[11px] text-neutral-500">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-3 rounded-[1px] bg-neutral-800" /> 수요(평가 요청)
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-3 rounded-[1px] bg-neutral-300" /> 공급 근사(완료 처리)
            </span>
          </div>
        </div>
      </section>

      <p className="mt-6 text-xs text-neutral-400">
        데이터 신뢰도: 수요/완료 건수는 공개 저장소의 실제 이벤트에서 집계(Confirmed by API). "공급"은 열린 슬롯을
        직접 반환하는 API가 없어(2026-07 조사 기준 폐기됨, docs/data-source-map.md 참고) 완료 처리량으로
        근사했으며, 이는 Observed 등급이다.
      </p>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-border bg-surface px-4 py-4 shadow-sm">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Bar({ label, value, max, colorClass }: { label: string; value: number; max: number; colorClass: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 text-[10px] text-neutral-400">{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-[2px] bg-neutral-100">
        <div className={`h-full ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right text-[10px] tabular-nums text-neutral-500">{value}</span>
    </div>
  );
}
