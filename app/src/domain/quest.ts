// 도메인 타입. UI/수집기와 분리된 순수 타입 계층.

export type Confidence = "confirmed_api" | "confirmed_ui" | "observed" | "inferred" | "unknown";

export interface QuestStateCounts {
  notStarted: number; // 미진행
  inProgress: number; // 진행중
  evalWaiting: number; // 평가 대기
  evalScheduled: number; // 평가 예정
  completed: number; // 완료
  reEval: number; // 재평가
}

export interface Quest {
  id: string;
  name: string;
  track: string; // 과정/트랙
  required: boolean;
  openSlots: number; // 평가 가능 슬롯 (Observed — EV Tracker 조사 결과 안정적 수집 경로 없음, mock 단계에서만 사용)
  states: QuestStateCounts;
  avgWaitHours: number; // 평균 평가 대기시간
  avgCompletionHours: number; // 평균 완료시간(학습시간 비용)
  firstAttemptPassRate: number; // 0~1
  retryRate: number; // 0~1, 재평가율
  unlocks: string[]; // 이 과제 완료로 해제되는 후속 과제 id
  level5Contribution: boolean; // Level5 조건 기여 여부 — confidence 필드로 확정/추정 구분
  sampleSize: number;
  confidence: Confidence;
  recentChangePct: number; // 최근 7일 완료 증가율(%), 양수=개선
}

export interface QuestMetrics {
  totalParticipants: number;
  demandSupplyRatio: number | null; // evalWaiting / openSlots, 공급 0이면 null
  bottleneckIndex: number; // 0~100
  bottleneckConfidence: Confidence;
}

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  confirmed_api: "API 확인",
  confirmed_ui: "화면 확인",
  observed: "관측됨",
  inferred: "추정",
  unknown: "확인 불가",
};
