import type { Quest } from "./quest";
import type { Member } from "./member";
import { remainingLevel5Quests } from "./progress";

export type StrategyId = "fastest" | "safest" | "low_wait" | "efficient" | "balanced";

export interface StrategyPath {
  id: StrategyId;
  label: string;
  description: string;
  questOrder: Quest[];
  totalHours: number;
  totalWaitHours: number;
  estimatedDays: number;
  reason: string;
}

const STRATEGY_META: Record<StrategyId, { label: string; description: string }> = {
  fastest: { label: "가장 빠른 경로", description: "학습시간+대기시간 합이 가장 짧은 순" },
  safest: { label: "가장 안전한 경로", description: "재평가율이 낮은 순 — 실패 위험 최소화" },
  low_wait: { label: "대기가 적은 경로", description: "평균 평가 대기시간이 짧은 순" },
  efficient: { label: "시간당 진척이 높은 경로", description: "투입 시간 대비 진척가치(Level5 기여)가 높은 순" },
  balanced: { label: "균형 경로", description: "시간·대기·위험을 동일 가중치로 정규화한 합산 순" },
};

function sortedBy<T>(items: T[], key: (item: T) => number): T[] {
  return [...items].sort((a, b) => key(a) - key(b));
}

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return (value - min) / (max - min);
}

// 각 전략은 남은 Level5 기여 과제를 서로 다른 기준으로 정렬한 explainable heuristic이다.
// ML/최적화 솔버가 아니라 표본 규모에 맞는 가장 단순한 방법을 우선한다 (brief 11항).
export function buildStrategyPaths(quests: Quest[], member: Member): StrategyPath[] {
  const remaining = remainingLevel5Quests(quests, member);
  if (remaining.length === 0) return [];

  const hoursRange = [Math.min(...remaining.map((q) => q.avgCompletionHours)), Math.max(...remaining.map((q) => q.avgCompletionHours))];
  const waitRange = [Math.min(...remaining.map((q) => q.avgWaitHours)), Math.max(...remaining.map((q) => q.avgWaitHours))];
  const retryRange = [Math.min(...remaining.map((q) => q.retryRate)), Math.max(...remaining.map((q) => q.retryRate))];

  const orders: Record<StrategyId, Quest[]> = {
    fastest: sortedBy(remaining, (q) => q.avgCompletionHours + q.avgWaitHours),
    safest: sortedBy(remaining, (q) => q.retryRate * 100 + (q.sampleSize < 10 ? 20 : 0)),
    low_wait: sortedBy(remaining, (q) => q.avgWaitHours),
    efficient: sortedBy(remaining, (q) => q.avgCompletionHours + q.avgWaitHours), // value 동일(모두 Level5 기여)하므로 비용 최소화와 동치
    balanced: sortedBy(
      remaining,
      (q) =>
        normalize(q.avgCompletionHours, hoursRange[0], hoursRange[1]) +
        normalize(q.avgWaitHours, waitRange[0], waitRange[1]) +
        normalize(q.retryRate, retryRange[0], retryRange[1])
    ),
  };

  return (Object.keys(orders) as StrategyId[]).map((id) => {
    const questOrder = orders[id];
    const totalHours = questOrder.reduce((s, q) => s + q.avgCompletionHours, 0);
    const totalWaitHours = questOrder.reduce((s, q) => s + q.avgWaitHours, 0);
    const estimatedDays = Math.ceil((totalHours + totalWaitHours) / 24);
    return {
      id,
      label: STRATEGY_META[id].label,
      description: STRATEGY_META[id].description,
      questOrder,
      totalHours,
      totalWaitHours,
      estimatedDays,
      reason: `${STRATEGY_META[id].description} 기준으로 ${questOrder.map((q) => q.name).join(" → ")} 순서를 추천`,
    };
  });
}
