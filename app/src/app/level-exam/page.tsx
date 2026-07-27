import Link from "next/link";
import { realQuests } from "@/data/real-quests";
import { mockMember } from "@/data/mock-member";
import { questStatus, NODE_STATUS_LABEL, type NodeStatus } from "@/domain/progress";
import {
  MISSION_TIER_XP,
  EVAL_COMPLETION_BONUS_XP,
  MISSION_XP_CONFIDENCE,
  LEVEL_XP_THRESHOLD_HEARSAY,
  LEVEL_THRESHOLD_CONFIDENCE,
  OBSERVED_LEVEL_DISTRIBUTION,
  LEVEL_DISTRIBUTION_CONFIDENCE,
} from "@/domain/leveling";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";

const STATUS_STYLE: Record<NodeStatus, string> = {
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  in_progress: "border-blue-200 bg-blue-50 text-blue-700",
  available: "border-neutral-300 bg-white text-neutral-700",
};

export default function LevelExamPage() {
  const member = mockMember;
  const nodes = realQuests.map((q) => ({ quest: q, status: questStatus(q, member) }));
  const maxDistCount = Math.max(...OBSERVED_LEVEL_DISTRIBUTION.map((d) => d.count));

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-lg font-semibold">레벨과 시험</h1>
      <p className="mt-1 text-sm text-neutral-500">{member.displayName} 기준</p>

      <section className="mt-6 rounded-sm border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-semibold tabular-nums">Lv.{member.level}</div>
            <div className="mt-1 text-sm text-neutral-500">경험치 {member.exp.toLocaleString()}</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium">Level 5 시험 응시 가능 여부</div>
            <div className="mt-1 flex items-center justify-end gap-2">
              <span className={member.level5ExamEligible ? "text-emerald-600" : "text-amber-600"}>
                {member.level5ExamEligible ? "가능" : "조건 미충족(추정)"}
              </span>
              <ConfidenceBadge level={member.level5ExamConfidence} />
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-neutral-400">
          레벨은 특정 과제 완료가 아니라 누적 경험치 임계값 도달로 오른다 — 아래 경험치 표 참고.
        </p>
      </section>

      <section className="mt-8">
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-sm font-medium text-neutral-700">레벨 분포</h2>
          <ConfidenceBadge level={LEVEL_DISTRIBUTION_CONFIDENCE} />
        </div>
        <p className="mt-1 text-xs text-neutral-500">특정 길드 기준 — 상위 레벨로 갈수록 급격히 줄어드는 피라미드 구조</p>
        <div className="mt-3 space-y-2 rounded-sm border border-border bg-surface p-4 shadow-sm">
          {OBSERVED_LEVEL_DISTRIBUTION.map((d) => (
            <div key={d.level} className="flex items-center gap-3 text-sm">
              <span className="w-10 text-neutral-500">Lv.{d.level}</span>
              <div className="h-3 flex-1 overflow-hidden rounded-[2px] bg-neutral-100">
                <div
                  className="h-full bg-neutral-800"
                  style={{ width: `${(d.count / maxDistCount) * 100}%` }}
                />
              </div>
              <span className="w-8 text-right tabular-nums text-neutral-500">{d.count}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-sm font-medium text-neutral-700">미션 단계별 경험치</h2>
          <ConfidenceBadge level={MISSION_XP_CONFIDENCE} />
        </div>
        <p className="mt-1 text-xs text-neutral-500">평가 완료 시 +{EVAL_COMPLETION_BONUS_XP} 보너스 별도</p>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {Object.entries(MISSION_TIER_XP).map(([tier, xp]) => (
            <div key={tier} className="rounded-sm border border-border bg-surface px-3 py-2 text-center shadow-sm">
              <div className="text-xs text-neutral-500">{tier}</div>
              <div className="mt-0.5 text-sm font-semibold tabular-nums">
                {xp === null ? <span className="text-neutral-400">미확인</span> : xp.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-neutral-500">
          <span>레벨 도달 누적 경험치</span>
          <ConfidenceBadge level={LEVEL_THRESHOLD_CONFIDENCE} />
        </div>
        <p className="mt-1 text-xs text-neutral-400">
          Lv.4 {LEVEL_XP_THRESHOLD_HEARSAY[4]} · Lv.5 {LEVEL_XP_THRESHOLD_HEARSAY[5]} — 미션 표 합산(약 7,800)과는
          차이가 있다.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-neutral-700">과제 진행 상태</h2>
        <p className="mt-1 text-xs text-neutral-500">과제 간 선행조건은 없다 — 순서 없이 자유롭게 선택할 수 있다.</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {nodes.map(({ quest: q, status }) => (
            <Link
              key={q.id}
              href={`/quests/${q.id}`}
              className={`rounded-sm border px-3 py-3 text-sm shadow-sm hover:opacity-80 ${STATUS_STYLE[status]}`}
            >
              <div className="font-medium">{q.name}</div>
              <div className="mt-1 text-[11px] opacity-80">{NODE_STATUS_LABEL[status]}</div>
            </Link>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-neutral-500">
          {(Object.keys(NODE_STATUS_LABEL) as NodeStatus[]).map((s) => (
            <span key={s} className="flex items-center gap-1">
              <span className={`inline-block h-2.5 w-2.5 rounded-[1px] border ${STATUS_STYLE[s]}`} />
              {NODE_STATUS_LABEL[s]}
            </span>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-neutral-700">시험 접수/결과</h2>
        <div className="mt-3 rounded-sm border border-dashed border-neutral-300 bg-surface px-4 py-6 text-center text-sm text-neutral-400">
          응시 가능한 시험이 없습니다
        </div>
      </section>
    </main>
  );
}
