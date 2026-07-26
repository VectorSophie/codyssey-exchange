import type { Quest, QuestMetrics, Confidence } from "./quest";

const MIN_RELIABLE_SAMPLE = 10;

export function totalParticipants(q: Quest): number {
  const s = q.states;
  return s.notStarted + s.inProgress + s.evalWaiting + s.evalScheduled + s.completed + s.reEval;
}

export function demandSupplyRatio(q: Quest): number | null {
  if (q.openSlots <= 0) return null;
  return q.states.evalWaiting / q.openSlots;
}

// 병목지수: 정체/대기/공급부족/재평가율/완료시간분산 대신 관측 가능한 근사치를 가중합.
// 가중치는 초안이며 실측 후 조정한다 — docs/metric-catalog.md 참고.
export function bottleneckIndex(q: Quest): number {
  const waitScore = Math.min(q.avgWaitHours / 72, 1) * 25; // 72h 이상 대기면 만점
  const dsr = demandSupplyRatio(q);
  const supplyScore = dsr === null ? 20 : Math.min(dsr / 3, 1) * 20; // 슬롯 미확보 시 관측 불가로 중간값
  const retryScore = q.retryRate * 15;
  const stagnation = q.states.evalWaiting + q.states.inProgress;
  const stagnationScore = Math.min(stagnation / Math.max(totalParticipants(q), 1), 1) * 25;
  const samplePenalty = q.sampleSize < MIN_RELIABLE_SAMPLE ? 5 : 0;
  return Math.round(waitScore + supplyScore + retryScore + stagnationScore + samplePenalty);
}

export function bottleneckConfidence(q: Quest): Confidence {
  if (q.sampleSize < MIN_RELIABLE_SAMPLE) return "inferred";
  if (q.openSlots === 0) return "observed"; // 공급 데이터가 없어 근사치 포함
  return q.confidence;
}

export function computeMetrics(q: Quest): QuestMetrics {
  return {
    totalParticipants: totalParticipants(q),
    demandSupplyRatio: demandSupplyRatio(q),
    bottleneckIndex: bottleneckIndex(q),
    bottleneckConfidence: bottleneckConfidence(q),
  };
}

export function isLowSample(q: Quest): boolean {
  return q.sampleSize < MIN_RELIABLE_SAMPLE;
}
