import Link from "next/link";
import { realQuests, getQuestById } from "@/data/real-quests";
import { mockMember } from "@/data/mock-member";
import { remainingLevel5Quests } from "@/domain/progress";
import { buildStrategyPaths } from "@/domain/optimizer";
import { readRealMeFile } from "@/lib/real-me";

export default function MyStrategyPage() {
  const member = mockMember;
  const remaining = remainingLevel5Quests(realQuests, member);
  const strategies = buildStrategyPaths(realQuests, member);
  const realMe = readRealMeFile();

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-lg font-semibold">내 전략</h1>
      <p className="mt-1 text-sm text-neutral-500">
        과제 카탈로그는 실제 데이터 · 진행 상태는 {member.displayName}(데모 페르소나) 기준
      </p>

      {realMe ? (
        <div className="mt-3 rounded-sm border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-800">
          실제 연동 데이터 감지됨 (수집 {realMe.collectedAt}) — 응답 필드 매핑은 아직 검증 전이라 아래 화면에는
          반영하지 않았다. <code>scripts/collect-me.mjs</code>가 <code>data/private/me.json</code>에 원본을
          저장해두었으니, 필드 구조 확인 후 Member 어댑터를 연결한다.
        </div>
      ) : (
        <div className="mt-3 rounded-sm border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
          본인 데이터로 바꾸려면: <code>cp .env.example .env</code> 후 CODYSSEY_SESSION 값을 채우고{" "}
          <code>node scripts/collect-me.mjs</code> 실행.
        </div>
      )}

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="현재 레벨" value={`Lv.${member.level}`} />
        <Stat label="경험치" value={member.exp.toLocaleString()} />
        <Stat label="포인트" value={member.points.toLocaleString()} />
        <Stat label="주간 가용시간" value={`${member.weeklyAvailableHours}h`} />
      </section>

      <section className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <QuestIdList title="완료 과제" ids={member.completedQuestIds} />
        <QuestIdList title="진행중 과제" ids={member.inProgressQuestIds} />
        <QuestIdList title="관심 과제" ids={member.watchlistQuestIds} />
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-neutral-700">Level 5 시험까지 남은 과제</h2>
        <p className="mt-1 text-xs text-neutral-500">
          &ldquo;Level 5 시험 응시 조건&rdquo;은 공식 필드로 확인되지 않아, 남은 Level5 기여 과제 완료 여부로 근사한다 (추정).
        </p>
        <div className="mt-2 overflow-hidden rounded-sm border border-border bg-surface shadow-sm">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
              <tr className="border-b border-border">
                <th className="px-3 py-2 font-medium">과제명</th>
                <th className="px-3 py-2 text-right font-medium">공식 학습시간</th>
                <th className="px-3 py-2 text-right font-medium">트랙 평균처리</th>
              </tr>
            </thead>
            <tbody>
              {remaining.map((q) => (
                <tr key={q.id} className="border-b border-neutral-100 last:border-0">
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
          <h2 className="text-sm font-medium text-neutral-700">추천 경로 (5가지 전략)</h2>
          <Link href="/level-exam" className="text-xs text-neutral-500 hover:text-neutral-900">
            레벨과 시험 →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {strategies.map((s) => (
            <div key={s.id} className="rounded-sm border border-border bg-surface p-4 shadow-sm">
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-semibold">{s.label}</h3>
                <span className="text-xs text-neutral-400">약 {s.estimatedDays}일</span>
              </div>
              <p className="mt-1 text-xs text-neutral-500">{s.description}</p>
              <ol className="mt-3 space-y-1 text-sm">
                {s.questOrder.map((q, i) => (
                  <li key={q.id} className="flex items-center gap-2">
                    <span className="text-[11px] text-neutral-400">{i + 1}</span>
                    <Link href={`/quests/${q.id}`} className="hover:underline">
                      {q.name}
                    </Link>
                  </li>
                ))}
              </ol>
              <div className="mt-3 flex gap-4 text-[11px] text-neutral-500">
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
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function QuestIdList({ title, ids }: { title: string; ids: string[] }) {
  return (
    <div className="rounded-sm border border-border bg-surface p-4 shadow-sm">
      <h3 className="text-xs font-medium text-neutral-500">
        {title} ({ids.length})
      </h3>
      {ids.length === 0 ? (
        <p className="mt-2 text-xs text-neutral-400">없음</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {ids.map((id) => {
            const q = getQuestById(id);
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
