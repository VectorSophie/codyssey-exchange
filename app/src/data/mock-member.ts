import type { Member } from "@/domain/member";

// 데모 페르소나. 과제 카탈로그(이름/트랙/학습시간/상태분포 등)는 실제 데이터이고, 실제 세션을 연결하면
// lib/codyssey-client.ts의 mapRealMember가 레벨·경험치·포인트·완료/진행중 과제까지 본인 데이터로
// 덮어쓴다(README 참고). 세션이 없을 때만 이 예시 진행 상태로 UI를 시연한다.
// 사용자 요청으로 기본 레벨은 5로 고정.
export const mockMember: Member = {
  id: "demo",
  displayName: "데모 계정",
  level: 5,
  exp: 15200,
  nextLevelExp: null,
  points: 1240,
  weeklyAvailableHours: 12,
  completedQuestIds: ["q185006", "q185007", "q185004", "q185012", "q185010"],
  inProgressQuestIds: ["q185005"],
  level5ExamEligible: false,
  level5ExamConfidence: "inferred",
};
