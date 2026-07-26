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
