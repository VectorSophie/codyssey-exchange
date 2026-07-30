import type { Confidence } from "./quest";

// 미션 단계별 지급 경험치. 2026-07-28 사용자가 직접 확인(4-1은 최초 전언 1600에서 1200으로 정정,
// 6-1/6-2 신규 확인). 5-2, 5-3은 아직 확인 못함 — null로 명시하고 존재 여부조차 단정하지 않는다.
export const MISSION_TIER_XP: Record<string, number | null> = {
  "1-1": 600,
  "1-2": 600,
  "2-1": 900,
  "2-2": 300,
  "3-1": 1200,
  "3-2": 1200,
  "4-1": 1200,
  "4-2": 1200,
  "5-1": 600,
  "5-2": null,
  "5-3": null,
  "6-1": 600,
  "6-2": 600,
};
export const EVAL_COMPLETION_BONUS_XP = 5; // 평가 종료 시 지급 — 최초 전언 그대로, 별도 재확인 안 됨
export const MISSION_XP_CONFIDENCE: Confidence = "observed"; // 사용자 본인이 인게임에서 직접 확인(API 응답 확인은 아님)

// 레벨 도달에 필요한 누적 경험치. Lv.5는 2026-07-30 실사용자 세션의 point/pnt/total/detail.
// nextLvlRequiredExprc로 직접 확인됨(Lv.4 계정 기준 다음 레벨 요구치 8,800) — 미션별 합(5-2/5-3 제외 시
// 약 7,800)과는 차이가 있다(5-2/5-3 존재 또는 평가 보너스 누적으로 메워질 가능성). Lv.4는 여전히 2차
// 전언, 미검증.
export const LEVEL_XP_THRESHOLD: Record<number, { value: string; confidence: Confidence }> = {
  4: { value: "약 6,000~6,500", confidence: "unknown" },
  5: { value: "8,800", confidence: "confirmed_api" },
};

// 길드 랭킹 상세 화면에서 사용자가 직접 확인한 레벨 분포(2026-07-28, 특정 길드 기준)
export const OBSERVED_LEVEL_DISTRIBUTION: { level: number; count: number }[] = [
  { level: 3, count: 15 },
  { level: 4, count: 3 },
  { level: 5, count: 1 },
  { level: 6, count: 1 },
];
export const LEVEL_DISTRIBUTION_CONFIDENCE: Confidence = "confirmed_ui"; // 화면에서 직접 확인
