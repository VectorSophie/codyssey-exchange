import type { Member } from "@/domain/member";

// 기본 페르소나 — Level 5, 시험 응시 조건 확인 진행 중 (사용자 요청으로 디폴트 Level 5).
export const mockMember: Member = {
  id: "me",
  displayName: "나",
  level: 5,
  exp: 15200,
  nextLevelExp: null,
  points: 1240,
  weeklyAvailableHours: 12,
  completedQuestIds: ["linux-permission", "network-basics", "git-advanced", "database-basics", "process-management"],
  inProgressQuestIds: ["system-call"],
  watchlistQuestIds: ["socket-programming"],
  level5ExamEligible: false,
  level5ExamConfidence: "inferred",
};
