import Link from "next/link";
import { cookies } from "next/headers";
import type { Quest } from "@/domain/quest";
import { getRealQuests } from "@/data/real-quests";
import { mockMember } from "@/data/mock-member";
import { remainingQuests } from "@/domain/progress";
import { buildStrategyPaths } from "@/domain/optimizer";
import { fetchRealMember } from "@/lib/codyssey-client";
import { SessionPrompt } from "@/components/SessionPrompt";

export const revalidate = 0; // 실제 세션 연동은 매 요청 최신 상태를 봐야 하므로 캐시하지 않는다.

export default async function MyStrategyPage() {
  const { quests: realQuests } = await getRealQuests();
  const member = mockMember;
  const remaining = remainingQuests(realQuests, member);
  const strategies = buildStrategyPaths(realQuests, member);
  const cookieStore = await cookies();
  const visitorSession = cookieStore.get("codyssey_session")?.value ?? null;
  const realMember = await fetchRealMember(visitorSession);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-lg font-semibold">내 전략</h1>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{member.displayName} 기준</p>

      {!realMember ? (
        <div className="mt-3 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          <p>아래 레벨·경험치·완료/진행중 과제는 데모 예시 데이터입니다 — 본인 진행 상태가 아닙니다.</p>
          <SessionPrompt hasSessionCookie={!!visitorSession} />
        </div>
      ) : (
        <div className="mt-3 rounded-sm border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-800 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300">
          <p>
            실제 세션 연동됨 (조회 {realMember.fetchedAt.slice(0, 19)}) — 응답 필드 구조가 아직 검증되지 않아 아래
            레벨·경험치·완료 목록은 여전히 데모 예시입니다.
          </p>
          <details className="mt-1">
            <summary className="cursor-pointer">원본 응답 보기</summary>
            <pre className="mt-1 max-h-64 overflow-auto rounded-sm bg-white p-2 text-[10px] text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
              {JSON.stringify(realMember, null, 2)}
            </pre>
          </details>
          <SessionPrompt hasSessionCookie={true} />
        </div>
      )}

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="현재 레벨" value={`Lv.${member.level}`} />
        <Stat label="경험치" value={member.exp.toLocaleString()} />
        <Stat label="포인트" value={member.points.toLocaleString()} />
        <Stat label="주간 가용시간" value={`${member.weeklyAvailableHours}h`} />
      </section>

      <section className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <QuestIdList title="완료 과제" ids={member.completedQuestIds} quests={realQuests} />
        <QuestIdList title="진행중 과제" ids={member.inProgressQuestIds} quests={realQuests} />
        <QuestIdList title="관심 과제" ids={member.watchlistQuestIds} quests={realQuests} />
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          남은 과제 ({remaining.length}개)
        </h2>
        <div className="mt-2 overflow-hidden rounded-sm border border-border bg-surface shadow-sm">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-neutral-50 text-left text-xs text-neutral-500 dark:bg-white/5 dark:text-neutral-400">
              <tr className="border-b border-border">
                <th className="px-3 py-2 font-medium">과제명</th>
                <th className="px-3 py-2 text-right font-medium">공식 학습시간</th>
                <th className="px-3 py-2 text-right font-medium">트랙 평균처리</th>
              </tr>
            </thead>
            <tbody>
              {remaining.map((q) => (
                <tr
                  key={q.id}
                  className="border-b border-neutral-100 last:border-0 dark:border-neutral-800"
                >
                  <td className="px-3 py-2">
                    <Link href={`/quests/${q.id}`} className="font-medium hover:underline">
                      {q.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{q.officialLearningHours}h</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {q.avgWaitHours === null ? "—" : `${q.avgWaitHours}h`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">추천 경로 (5가지 전략)</h2>
          <Link
            href="/level-exam"
            className="text-xs text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
          >
            레벨과 시험 →
          </Link>
        </div>

        {strategies.length > 0 && (
          <div className="mb-3 rounded-sm border border-border bg-surface p-4 shadow-sm">
            <div className="space-y-1.5">
              {strategies.map((s) => {
                const total = Math.round((s.totalHours + s.totalWaitHours) * 10) / 10;
                const maxTotal = Math.max(...strategies.map((x) => x.totalHours + x.totalWaitHours));
                return (
                  <div key={s.id} className="grid grid-cols-[6.5rem_1fr_3rem] items-center gap-2 text-xs">
                    <span className="text-neutral-500 dark:text-neutral-400">{s.label}</span>
                    <div className="flex h-2.5 overflow-hidden rounded-[2px] bg-neutral-100 dark:bg-neutral-800">
                      <div
                        className="h-full bg-neutral-800 dark:bg-neutral-300"
                        style={{ width: `${(s.totalHours / maxTotal) * 100}%` }}
                      />
                      <div
                        className="h-full bg-amber-400"
                        style={{ width: `${(s.totalWaitHours / maxTotal) * 100}%` }}
                      />
                    </div>
                    <span className="text-right tabular-nums text-neutral-500 dark:text-neutral-400">{total}h</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex gap-4 text-[11px] text-neutral-500 dark:text-neutral-400">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-3 rounded-[1px] bg-neutral-800 dark:bg-neutral-300" /> 학습시간
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-3 rounded-[1px] bg-amber-400" /> 평가대기
              </span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {strategies.map((s) => (
            <div key={s.id} className="rounded-sm border border-border bg-surface p-4 shadow-sm">
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-semibold dark:text-neutral-100">{s.label}</h3>
                <span className="text-xs text-neutral-400 dark:text-neutral-500">약 {s.estimatedDays}일</span>
              </div>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{s.description}</p>
              <ol className="mt-3 space-y-1 text-sm">
                {s.questOrder.map((q, i) => (
                  <li key={q.id} className="flex items-center gap-2">
                    <span className="text-[11px] text-neutral-400 dark:text-neutral-500">{i + 1}</span>
                    <Link href={`/quests/${q.id}`} className="hover:underline">
                      {q.name}
                    </Link>
                  </li>
                ))}
              </ol>
              <div className="mt-3 flex gap-4 text-[11px] text-neutral-500 dark:text-neutral-400">
                <span>학습시간 {s.totalHours}h</span>
                <span>평가대기 {s.totalWaitHours}h</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-border bg-surface px-4 py-4 shadow-sm">
      <div className="text-xs text-neutral-500 dark:text-neutral-400">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums dark:text-neutral-100">{value}</div>
    </div>
  );
}

function QuestIdList({ title, ids, quests }: { title: string; ids: string[]; quests: Quest[] }) {
  return (
    <div className="rounded-sm border border-border bg-surface p-4 shadow-sm">
      <h3 className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
        {title} ({ids.length})
      </h3>
      {ids.length === 0 ? (
        <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">없음</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {ids.map((id) => {
            const q = quests.find((quest) => quest.id === id);
            return (
              <li key={id}>
                <Link href={`/quests/${id}`} className="hover:underline">
                  {q?.name ?? id}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
