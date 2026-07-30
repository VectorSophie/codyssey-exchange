import type { Member } from "@/domain/member";

// 데모 페르소나. 과제 카탈로그(이름/트랙/학습시간/상태분포 등)는 실제 데이터이지만,
// "이 사람이 무엇을 완료했는가"는 lib/codyssey-client.ts로 실시간 조회해도 필드 매핑이 아직
// 검증되지 않아(README 알려진 한계) 계속 이 예시 진행 상태로 UI를 시연한다.
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
  watchlistQuestIds: ["q185008"],
  level5ExamEligible: false,
  level5ExamConfidence: "inferred",
};
