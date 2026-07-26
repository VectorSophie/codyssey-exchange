import type { Quest } from "./quest";
import type { Member } from "./member";

export type NodeStatus = "completed" | "in_progress" | "available" | "locked" | "unknown";

export const NODE_STATUS_LABEL: Record<NodeStatus, string> = {
  completed: "완료",
  in_progress: "진행중",
  available: "실행가능",
  locked: "잠김",
  unknown: "조건 미확인",
};

// unlocks(A→B)의 역방향으로 B의 선행조건(=A들)을 구한다.
export function requiredByMap(quests: Quest[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const q of quests) {
    for (const target of q.unlocks) {
      map.set(target, [...(map.get(target) ?? []), q.id]);
    }
  }
  return map;
}

export function questStatus(quest: Quest, member: Member, quests: Quest[]): NodeStatus {
  if (member.completedQuestIds.includes(quest.id)) return "completed";
  if (member.inProgressQuestIds.includes(quest.id)) return "in_progress";
  const prereqs = requiredByMap(quests).get(quest.id) ?? [];
  if (prereqs.length === 0) return "available";
  const allDone = prereqs.every((id) => member.completedQuestIds.includes(id));
  return allDone ? "available" : "locked";
}

export function remainingLevel5Quests(quests: Quest[], member: Member): Quest[] {
  return quests.filter((q) => q.level5Contribution && !member.completedQuestIds.includes(q.id));
}
