import Link from "next/link";
import { getRealQuests } from "@/data/real-quests";
import { bottleneckIndex, bottleneckConfidence, totalParticipants, isLowSample } from "@/domain/metrics";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { ChangeValue } from "@/components/ChangeValue";

export const revalidate = 300;

export default async function QuestMarketPage() {
  const { quests: realQuests, dataGeneratedAt } = await getRealQuests();
  const rows = realQuests
    .map((q) => ({
      quest: q,
      bottleneck: bottleneckIndex(q),
      confidence: bottleneckConfidence(q),
      participants: totalParticipants(q),
    }))
    .sort((a, b) => b.bottleneck - a.bottleneck);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">과제 시세</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            전체 {realQuests.length}개 과제(AI/SW 기초) · 병목지수 높은 순 · 수집 {dataGeneratedAt.slice(0, 10)}
          </p>
        </div>
        <Link
          href="/"
          className="text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
        >
          ← 시장 개요
        </Link>
      </div>

      <div className="mb-6 rounded-sm border border-border bg-surface p-4 shadow-sm">
        <h2 className="text-xs font-medium text-neutral-500 dark:text-neutral-400">병목지수 분포</h2>
        <div className="mt-3 space-y-1.5">
          {rows.map(({ quest: q, bottleneck }) => (
            <div key={q.id} className="grid grid-cols-[1fr_2.5rem] items-center gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-40 shrink-0 truncate text-neutral-500 dark:text-neutral-400">{q.name}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-[2px] bg-neutral-100 dark:bg-neutral-800">
                  <div
                    className={bottleneck >= 60 ? "h-full bg-amber-500" : "h-full bg-neutral-400"}
                    style={{ width: `${Math.min(bottleneck, 100)}%` }}
                  />
                </div>
              </div>
              <span className="text-right tabular-nums text-neutral-600 dark:text-neutral-400">{bottleneck}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="mb-1 text-[11px] text-neutral-400 sm:hidden">← 옆으로 스크롤하면 트랙·참여인원 등을 더 볼 수 있습니다</p>
      <div className="overflow-x-auto rounded-sm border border-border bg-surface shadow-sm">
        <table className="w-full border-collapse text-sm sm:min-w-[720px] md:min-w-[960px]">
          <thead className="sticky top-0 bg-neutral-50 text-left text-xs text-neutral-500 dark:bg-white/5 dark:text-neutral-400">
            <tr className="border-b border-border">
              <th className="px-3 py-2 font-medium">과제명</th>
              <th className="hidden px-3 py-2 font-medium md:table-cell">트랙</th>
              <th className="hidden px-3 py-2 font-medium md:table-cell">필수</th>
              <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">참여인원</th>
              <th className="px-3 py-2 text-right font-medium">평가대기</th>
              <th className="hidden px-3 py-2 text-right font-medium md:table-cell">트랙 평균처리(h)</th>
              <th className="hidden px-3 py-2 text-right font-medium md:table-cell">공식학습시간(h)</th>
              <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">평가 PASS율</th>
              <th className="px-3 py-2 text-right font-medium">최근변화</th>
              <th className="px-3 py-2 text-right font-medium">병목지수</th>
              <th className="hidden px-3 py-2 font-medium md:table-cell">신뢰도</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ quest: q, bottleneck, confidence, participants }) => (
              <tr
                key={q.id}
                className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-white/5"
              >
                <td className="px-3 py-2">
                  <Link
                    href={`/quests/${q.id}`}
                    className="font-medium text-neutral-900 hover:underline dark:text-neutral-100"
                  >
                    {q.name}
                  </Link>
                  {isLowSample(q) && (
                    <span className="ml-1.5 text-[11px] text-neutral-400 dark:text-neutral-500">
                      표본 {q.sampleSize}건
                    </span>
                  )}
                </td>
                <td className="hidden px-3 py-2 text-neutral-600 md:table-cell dark:text-neutral-400">{q.track}</td>
                <td className="hidden px-3 py-2 md:table-cell">
                  {q.required ? (
                    <span className="text-[11px] text-neutral-700 dark:text-neutral-300">필수</span>
                  ) : (
                    <span className="text-[11px] text-neutral-400 dark:text-neutral-500">선택</span>
                  )}
                </td>
                <td className="hidden px-3 py-2 text-right tabular-nums sm:table-cell">{participants}</td>
                <td className="px-3 py-2 text-right tabular-nums">{q.states.evalWaiting}</td>
                <td className="hidden px-3 py-2 text-right tabular-nums md:table-cell">
                  {q.avgWaitHours === null ? (
                    <span className="text-neutral-400 dark:text-neutral-500">—</span>
                  ) : (
                    q.avgWaitHours
                  )}
                </td>
                <td className="hidden px-3 py-2 text-right tabular-nums md:table-cell">
                  {q.officialLearningHours}
                </td>
                <td className="hidden px-3 py-2 text-right tabular-nums sm:table-cell">
                  {q.passRate === null ? (
                    <span className="text-neutral-400 dark:text-neutral-500">표본없음</span>
                  ) : (
                    `${(q.passRate * 100).toFixed(0)}%`
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <ChangeValue pct={q.recentChangePct} />
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">{bottleneck}</td>
                <td className="hidden px-3 py-2 md:table-cell">
                  <ConfidenceBadge level={confidence} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-neutral-400 dark:text-neutral-500">
        평가 수요/공급의 시간대별 분포는{" "}
        <Link href="/eval-market" className="underline">
          평가 시장
        </Link>
        에서 확인할 수 있습니다.
      </p>
    </main>
  );
}
