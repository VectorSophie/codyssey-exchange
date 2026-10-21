import Link from "next/link";
import { cookies } from "next/headers";
import { getRealQuests } from "@/data/real-quests";
import { mockMember } from "@/data/mock-member";
import { questStatus, NODE_STATUS_LABEL, type NodeStatus } from "@/domain/progress";
import {
  MISSION_TIER_XP,
  EVAL_COMPLETION_BONUS_XP,
  MISSION_XP_CONFIDENCE,
  LEVEL_XP_THRESHOLD,
  OBSERVED_LEVEL_DISTRIBUTION,
  LEVEL_DISTRIBUTION_CONFIDENCE,
} from "@/domain/leveling";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { fetchRealMember, mapRealMember, fetchRealLevelDistribution } from "@/lib/codyssey-client";
import { SessionPrompt } from "@/components/SessionPrompt";

const STATUS_STYLE: Record<NodeStatus, string> = {
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  in_progress: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
  available: "border-neutral-300 bg-white text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300",
};

export const revalidate = 0; // 실제 세션 연동은 매 요청 최신 상태를 봐야 하므로 캐시하지 않는다.

export default async function LevelExamPage() {
  const { quests: realQuests } = await getRealQuests();
  const cookieStore = await cookies();
  const visitorSession = cookieStore.get("codyssey_session")?.value ?? null;
  const realMember = await fetchRealMember(visitorSession);
  const realFields = realMember ? mapRealMember(realMember) : null;
  const member = realFields ? { ...mockMember, ...realFields } : mockMember;
  const nodes = realQuests.map((q) => ({ quest: q, status: questStatus(q, member) }));

  const realDistribution = await fetchRealLevelDistribution(visitorSession);
  // 막대는 레벨별 합계, 옆에 기수별 내역을 붙인다(관측 스냅샷 폴백은 기수 구분이 없다).
  const byLevel = new Map<number, { level: number; count: number; cohorts: Record<string, number> }>();
  for (const d of (realDistribution ?? OBSERVED_LEVEL_DISTRIBUTION) as { level: number; count: number; cohort?: string }[]) {
    const e = byLevel.get(d.level) ?? { level: d.level, count: 0, cohorts: {} };
    e.count += d.count;
    if (d.cohort) e.cohorts[d.cohort] = (e.cohorts[d.cohort] ?? 0) + d.count;
    byLevel.set(d.level, e);
  }
  const levelDistribution = [...byLevel.values()].sort((a, b) => a.level - b.level);
  const cohortTotals: Record<string, number> = {};
  for (const d of realDistribution ?? []) cohortTotals[d.cohort] = (cohortTotals[d.cohort] ?? 0) + d.count;
  const distributionCourse = realDistribution?.[0]?.course;
  const levelDistributionConfidence = realDistribution ? "confirmed_api" : LEVEL_DISTRIBUTION_CONFIDENCE;
  const maxDistCount = Math.max(...levelDistribution.map((d) => d.count));

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-lg font-semibold">레벨과 시험</h1>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{member.displayName} 기준</p>

      {!realMember ? (
        <div className="mt-3 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          <p>아래 레벨·경험치·과제 진행 상태는 데모 예시 데이터입니다 — 본인 진행 상태가 아닙니다.</p>
          <SessionPrompt hasSessionCookie={!!visitorSession} />
        </div>
      ) : (
        <div className="mt-3 rounded-sm border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-800 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300">
          <p>
            실제 세션 연동됨 (조회 {realMember.fetchedAt.slice(0, 19)}) —{" "}
            {realFields
              ? "레벨·경험치·닉네임·과제 진행 상태는 본인 데이터입니다."
              : "응답 구조가 예상과 달라 매핑에 실패했습니다 — 아래는 여전히 데모 예시입니다."}
          </p>
          <SessionPrompt hasSessionCookie={true} />
        </div>
      )}

      <section className="mt-6 rounded-sm border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-semibold tabular-nums dark:text-neutral-100">Lv.{member.level}</div>
            <div className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              경험치 {member.exp.toLocaleString()}
              {realFields && `  (다음 레벨까지 ${realFields.nextLevelExp.toLocaleString()})`}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium dark:text-neutral-200">Level 5 시험 응시 가능 여부</div>
            <div className="mt-1 flex items-center justify-end gap-2">
              <span className={member.level5ExamEligible ? "text-red-600" : "text-blue-600"}>
                {member.level5ExamEligible ? "가능" : "조건 미충족(추정)"}
              </span>
              <ConfidenceBadge level={member.level5ExamConfidence} />
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-neutral-400 dark:text-neutral-500">
          레벨은 특정 과제 완료가 아니라 누적 경험치 임계값 도달로 오릅니다 — 아래 경험치 표를 참고하세요.
        </p>
      </section>

      <section className="mt-8">
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">레벨 분포</h2>
          <ConfidenceBadge level={levelDistributionConfidence} />
        </div>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          {realDistribution
            ? `이번 시즌 ${distributionCourse} 전체 길드 실시간 집계(${Object.entries(cohortTotals)
                .sort()
                .map(([c, n]) => `${c} ${n}명`)
                .join(" · ")}) — 기수는 회원번호 대역으로 추정, 다른 과정은 그 과정 세션이 필요합니다`
            : "특정 길드 기준(관측 스냅샷) — 상위 레벨로 갈수록 급격히 줄어드는 피라미드 구조"}
        </p>
        <div className="mt-3 space-y-2 rounded-sm border border-border bg-surface p-4 shadow-sm">
          {levelDistribution.map((d) => (
            <div key={d.level} className="flex items-center gap-3 text-sm">
              <span className="w-10 text-neutral-500 dark:text-neutral-400">Lv.{d.level}</span>
              <div className="h-3 flex-1 overflow-hidden rounded-[2px] bg-neutral-100 dark:bg-neutral-800">
                <div
                  className="h-full bg-neutral-800 dark:bg-neutral-300"
                  style={{ width: `${(d.count / maxDistCount) * 100}%` }}
                />
              </div>
              <span className="w-8 text-right tabular-nums text-neutral-500 dark:text-neutral-400">{d.count}</span>
              {realDistribution && (
                <span className="w-28 text-right text-xs tabular-nums text-neutral-400 dark:text-neutral-500">
                  1기 {d.cohorts["1기"] ?? 0} · 2기 {d.cohorts["2기"] ?? 0}
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">미션 단계별 경험치</h2>
          <ConfidenceBadge level={MISSION_XP_CONFIDENCE} />
        </div>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          평가 완료 시 +{EVAL_COMPLETION_BONUS_XP} 보너스 별도
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {Object.entries(MISSION_TIER_XP).map(([tier, xp]) => (
            <div key={tier} className="rounded-sm border border-border bg-surface px-3 py-2 text-center shadow-sm">
              <div className="text-xs text-neutral-500 dark:text-neutral-400">{tier}</div>
              <div className="mt-0.5 text-sm font-semibold tabular-nums dark:text-neutral-100">
                {xp === null ? (
                  <span className="text-neutral-400 dark:text-neutral-500">미확인</span>
                ) : (
                  xp.toLocaleString()
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">레벨 도달 누적 경험치</div>
        <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
          {realFields ? (
            <>다음 레벨(Lv.{member.level + 1})까지 {realFields.nextLevelExp.toLocaleString()} — 본인 데이터로 확인됨.</>
          ) : (
            <>
              Lv.4 {LEVEL_XP_THRESHOLD[4].value} <ConfidenceBadge level={LEVEL_XP_THRESHOLD[4].confidence} /> · Lv.5{" "}
              {LEVEL_XP_THRESHOLD[5].value} <ConfidenceBadge level={LEVEL_XP_THRESHOLD[5].confidence} /> — 미션 표
              합산(약 7,800)과는 차이가 있습니다.
            </>
          )}
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">과제 진행 상태</h2>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          과제 간 선행조건은 없습니다 — 순서 없이 자유롭게 선택할 수 있습니다.
        </p>
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
        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-neutral-500 dark:text-neutral-400">
          {(Object.keys(NODE_STATUS_LABEL) as NodeStatus[]).map((s) => (
            <span key={s} className="flex items-center gap-1">
              <span className={`inline-block h-2.5 w-2.5 rounded-[1px] border ${STATUS_STYLE[s]}`} />
              {NODE_STATUS_LABEL[s]}
            </span>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">시험 접수/결과</h2>
        <div className="mt-3 rounded-sm border border-dashed border-neutral-300 bg-surface px-4 py-6 text-center text-sm text-neutral-400 dark:border-neutral-700 dark:text-neutral-500">
          현재 접수 중이거나 응시 가능한 시험이 없습니다 — 조건 충족 시 이 자리에 표시됩니다.
        </div>
      </section>
    </main>
  );
}
