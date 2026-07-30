import type { Confidence } from "./quest";

export interface Member {
  id: string;
  displayName: string;
  level: number;
  exp: number;
  nextLevelExp: number | null; // null = 다음 레벨까지 필요한 경험치 조건 미확인
  points: number;
  weeklyAvailableHours: number;
  completedQuestIds: string[];
  inProgressQuestIds: string[];
  level5ExamEligible: boolean;
  level5ExamConfidence: Confidence; // 응시 가능 여부 판정 자체의 신뢰도
}
