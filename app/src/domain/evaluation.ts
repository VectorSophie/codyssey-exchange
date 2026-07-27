export interface EvalMarketAggregate {
  source: string;
  generatedAt: string;
  totalEvents: number;
  totalCompleted: number;
  totalCancelled: number;
  totalRequested: number;
  totalInProgress: number;
  dayLabels: string[];
  demandByDayHour: number[][];
  supplyByDayHour: number[][];
}

export interface HeatCell {
  day: number;
  hour: number;
  demand: number;
  supply: number;
  gap: number; // demand - supply, 양수면 부족
}

export function buildHeatCells(agg: EvalMarketAggregate): HeatCell[] {
  const cells: HeatCell[] = [];
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      const demand = agg.demandByDayHour[d][h];
      const supply = agg.supplyByDayHour[d][h];
      cells.push({ day: d, hour: h, demand, supply, gap: demand - supply });
    }
  }
  return cells;
}

export function maxAbsGap(cells: HeatCell[]): number {
  return Math.max(1, ...cells.map((c) => Math.abs(c.gap)));
}

export function weekdayTotals(agg: EvalMarketAggregate) {
  return agg.dayLabels.map((label, d) => ({
    label,
    demand: agg.demandByDayHour[d].reduce((s, v) => s + v, 0),
    supply: agg.supplyByDayHour[d].reduce((s, v) => s + v, 0),
  }));
}

// 요일 구분 없이 시간대(0~23)별로 합산 — 하루 안에서 수요/공급이 언제 엇갈리는지 보는 메인 차트용.
export function hourlyTotals(agg: EvalMarketAggregate): { demand: number[]; supply: number[] } {
  const demand = Array.from({ length: 24 }, (_, h) => agg.demandByDayHour.reduce((s, day) => s + day[h], 0));
  const supply = Array.from({ length: 24 }, (_, h) => agg.supplyByDayHour.reduce((s, day) => s + day[h], 0));
  return { demand, supply };
}
