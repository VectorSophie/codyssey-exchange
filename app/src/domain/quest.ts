// 도메인 타입. UI/수집기와 분리된 순수 타입 계층.

export type Confidence = "confirmed_api" | "confirmed_ui" | "observed" | "inferred" | "unknown";

export interface QuestStateCounts {
  notStarted: number; // 미진행
  inProgress: number; // 진행중
  evalWaiting: number; // 평가 대기
  completed: number; // 완료
}

export interface Quest {
  id: string;
  name: string;
  track: string; // 과정(lcors)
  course: string; // 상위 커리큘럼(예: AI/SW 기초)
  required: boolean; // 실제 requiredYn 필드
  officialLearningHours: number; // 공식 배정 학습시간 — Confirmed by API
  states: QuestStateCounts; // 실측 상태 분포 스냅샷 — Confirmed by API
  passCount: number;
  failCount: number;
  passRate: number | null; // pass/(pass+fail), 표본 0이면 null
  retryRate: number | null; // fail/(pass+fail)
  sampleSize: number;
  recentChangePct: number; // 실제 두 스냅샷(약 6일 간격) 완료건수 diff 기반
  avgWaitHours: number | null; // 같은 트랙 실제 평가 이벤트의 실측 평균 처리시간(요청→처리) — 과제 단위가 아니라 트랙 단위 근사
}

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  confirmed_api: "API 확인",
  confirmed_ui: "화면 확인",
  observed: "관측됨",
  inferred: "추정",
  unknown: "확인 불가",
};
