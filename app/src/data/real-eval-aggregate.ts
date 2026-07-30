import type { EvalMarketAggregate } from "@/domain/evaluation";
import { sql } from "@/lib/db";

// 실제 데이터, Postgres 조회. 원본은 codyssey_EV_Tracker(공개 저장소) 3개월치 이벤트를
// 시간대x요일로 집계한 것(PII 제거) — db/seed/eval-aggregate.json으로 커밋되어 있고
// scripts/seed-db.mjs로 DB에 반영한다. 앱은 DB만 읽는다.

interface MetaRow {
  source: string;
  generated_at: Date;
  total_events: number;
  total_completed: number;
  total_cancelled: number;
  total_requested: number;
  total_in_progress: number;
  day_labels: string[];
}

interface CellRow {
  day_of_week: number;
  hour: number;
  demand: number;
  supply: number;
}

export async function getRealEvalAggregate(): Promise<EvalMarketAggregate> {
  const [meta] = await sql<MetaRow[]>`select * from eval_aggregate_meta limit 1`;
  const cells = await sql<CellRow[]>`select * from eval_aggregate_cells`;

  const demandByDayHour: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  const supplyByDayHour: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const c of cells) {
    demandByDayHour[c.day_of_week][c.hour] = c.demand;
    supplyByDayHour[c.day_of_week][c.hour] = c.supply;
  }

  return {
    source: meta.source,
    generatedAt: meta.generated_at.toISOString(),
    totalEvents: meta.total_events,
    totalCompleted: meta.total_completed,
    totalCancelled: meta.total_cancelled,
    totalRequested: meta.total_requested,
    totalInProgress: meta.total_in_progress,
    dayLabels: meta.day_labels,
    demandByDayHour,
    supplyByDayHour,
  };
}
