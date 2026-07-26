import type { Quest, Confidence } from "./quest";

const MIN_RELIABLE_SAMPLE = 10;

export function totalParticipants(q: Quest): number {
  const s = q.states;
  return s.notStarted + s.inProgress + s.evalWaiting + s.completed;
}

// 병목지수: 평균 처리시간(트랙 실측) + 재평가율 + 정체 비율 + 표본 페널티의 가중합.
// "공급(열린 슬롯)" 데이터는 안정적 수집 경로가 없어 이 지수에서 제외했다 —
// 수급 자체는 평가 시장 페이지의 실측 수요/공급 히트맵을 따로 참고한다.
// 가중치는 초안이며 실측 후 조정한다 — docs/metric-catalog.md 참고.
export function bottleneckIndex(q: Quest): number {
  const avgWait = q.avgWaitHours;
  const waitScore = avgWait === null ? 15 : Math.min(avgWait / 24, 1) * 30;
  const retryScore = (q.retryRate ?? 0.15) * 25;
  const total = totalParticipants(q);
  const stagnation = q.states.evalWaiting + q.states.inProgress;
  const stagnationScore = total > 0 ? Math.min(stagnation / total, 1) * 35 : 0;
  const samplePenalty = q.sampleSize < MIN_RELIABLE_SAMPLE ? 10 : 0;
  return Math.round(waitScore + retryScore + stagnationScore + samplePenalty);
}

export function bottleneckConfidence(q: Quest): Confidence {
  if (q.sampleSize < MIN_RELIABLE_SAMPLE) return "inferred";
  if (q.avgWaitHours === null) return "observed";
  return "observed"; // 대기시간이 과제 단위가 아니라 트랙 단위 근사이므로 API 확인이 아닌 관측으로 표시
}

export function isLowSample(q: Quest): boolean {
  return q.sampleSize < MIN_RELIABLE_SAMPLE;
}
