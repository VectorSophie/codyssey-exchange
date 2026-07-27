import type { Quest } from "./quest";
import type { Member } from "./member";

// 과제 간 선행조건은 없다(사용자 확인, 2026-07-28: 순서 없이 자유 선택). 상태는 세 가지뿐이다.
export type NodeStatus = "completed" | "in_progress" | "available";

export const NODE_STATUS_LABEL: Record<NodeStatus, string> = {
  completed: "완료",
  in_progress: "진행중",
  available: "선택 가능",
};

export function questStatus(quest: Quest, member: Member): NodeStatus {
  if (member.completedQuestIds.includes(quest.id)) return "completed";
  if (member.inProgressQuestIds.includes(quest.id)) return "in_progress";
  return "available";
}

export function remainingQuests(quests: Quest[], member: Member): Quest[] {
  return quests.filter((q) => !member.completedQuestIds.includes(q.id));
}
