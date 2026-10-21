import type { Confidence } from "./quest";

// 미션 단계별 지급 경험치. 처음엔 전언 → 사용자 인게임 확인(observed)이었고, 2026-10-21 본인 경험치 내역
// (POST point/exp/list, exprcTypeNo 52 "평가결과 PASS 시 평가가이드에 명시된 경험치 기준으로 적립")을 평가 기록
// (ev/request/mbrSearch/searchList.evlEndDt)과 시각으로 맞춰 과제별로 확인했다. 규칙: 공식 학습시간(분) × 15(필수)
// / × 20(선택) — 확인된 값 전부 일치. 5-2(185013)는 그 대조에서 1,200으로 새로 확인. 단계 번호 ↔ 과제 대응은
// DATA.md 4.1절.
export const MISSION_TIER_XP: Record<string, number | null> = {
  "1-1": 600,
  "1-2": 600,
  "2-1": 900,
  "2-2": 300,
  "3-1": 1200,
  "3-2": 1200,
  "4-1": 1200,
  "4-2": 1600,
  "5-1": 600,
  "5-2": 1200,
  "5-3": 1200,
  "6-1": 600,
  "6-2": 600,
};
export const EVAL_COMPLETION_BONUS_XP = 5; // point/exp/list exprcTypeNo 24 "평가종료 시 학습자에게 적립" — 매번 5
export const MISSION_XP_CONFIDENCE: Confidence = "confirmed_api";

// 레벨 도달에 필요한 누적 경험치. point/pnt/total/detail.nextLvlRequiredExprc로 직접 확인.
// Lv.5는 2026-07-30 세션(Lv.4 계정 기준 다음 레벨 요구치 8,800)에서 확인, 이후 실제로 8,800을 넘겨
// 2026-08-05 17:21:59 Lv.5 도달(levelRegDt로 확인). 같은 세션에서 Lv.5 계정 기준 다음 레벨(Lv.6)
// 요구치 11,000을 동일 API로 확인. 이후 실제로 11,000을 넘겨 2026-08-20 00:51:35 Lv.6 도달, 같은
// API로 Lv.6 계정 기준 다음 레벨(Lv.7) 요구치 14,000 확인. 2026-10-21 Lv.8 계정에서 Lv.9 요구치 21,000
// 확인(Lv.8 임계값 자체는 못 봄). Lv.4는 여전히 2차 전언, 미검증.
export const LEVEL_XP_THRESHOLD: Record<number, { value: string; confidence: Confidence }> = {
  4: { value: "약 6,000~6,500", confidence: "unknown" },
  5: { value: "8,800", confidence: "confirmed_api" },
  6: { value: "11,000", confidence: "confirmed_api" },
  7: { value: "14,000", confidence: "confirmed_api" },
  9: { value: "21,000", confidence: "confirmed_api" },
};

// 길드 랭킹 상세 화면에서 사용자가 직접 확인한 레벨 분포(2026-07-28, 특정 길드 기준)
export const OBSERVED_LEVEL_DISTRIBUTION: { level: number; count: number }[] = [
  { level: 3, count: 15 },
  { level: 4, count: 3 },
  { level: 5, count: 1 },
  { level: 6, count: 1 },
];
export const LEVEL_DISTRIBUTION_CONFIDENCE: Confidence = "confirmed_ui"; // 화면에서 직접 확인
