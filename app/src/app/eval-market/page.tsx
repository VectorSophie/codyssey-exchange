import { Fragment } from "react";
import { getRealEvalAggregate } from "@/data/real-eval-aggregate";
import { buildHeatCells, maxAbsGap, weekdayTotals } from "@/domain/evaluation";
import { WeekdaySupplyDemandBars } from "@/components/WeekdaySupplyDemandBars";

export const revalidate = 300;

export default async function EvalMarketPage() {
  const agg = await getRealEvalAggregate();
  const cells = buildHeatCells(agg);
  const maxGap = maxAbsGap(cells);
  const weekly = weekdayTotals(agg);

  function cellStyle(gap: number) {
    if (gap <= 0) {
      const intensity = Math.min(Math.abs(gap) / maxGap, 1);
      return { backgroundColor: `rgba(37,99,235,${0.08 + intensity * 0.35})` }; // 여유(공급 우위) = 파랑
    }
    const intensity = Math.min(gap / maxGap, 1);
    return { backgroundColor: `rgba(220,38,38,${0.1 + intensity * 0.55})` }; // 부족(수요 우위) = 빨강
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-lg font-semibold">평가 시장</h1>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">집계 {agg.generatedAt.slice(0, 10)}</p>

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
        <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">시간대 × 요일 수급 히트맵</h2>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          빨강 = 수요(평가 요청)가 공급(완료 처리)보다 많은 시간대 · 파랑 = 공급이 수요보다 여유 있는 시간대
        </p>
        <p className="mt-1 text-[11px] text-neutral-400 lg:hidden">← 옆으로 스크롤하면 나머지 시간대를 볼 수 있습니다</p>
        <div className="mt-3 overflow-x-auto rounded-sm border border-border bg-surface p-4 shadow-sm">
          <div className="grid min-w-[820px] grid-cols-[2.5rem_repeat(24,1fr)] gap-[2px] text-[10px]">
            <div />
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="text-center text-neutral-400 dark:text-neutral-500">
                {h % 3 === 0 ? h : ""}
              </div>
            ))}
            {agg.dayLabels.map((label, d) => (
              <Fragment key={`row-${d}`}>
                <div className="flex items-center text-neutral-500 dark:text-neutral-400">{label}</div>
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
        <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">요일별 수요 vs 공급</h2>
        <div className="mt-3 rounded-sm border border-border bg-surface p-4 shadow-sm">
          <WeekdaySupplyDemandBars weekly={weekly} />
        </div>
      </section>

    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-border bg-surface px-4 py-4 shadow-sm">
      <div className="text-xs text-neutral-500 dark:text-neutral-400">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums dark:text-neutral-100">{value}</div>
    </div>
  );
}
