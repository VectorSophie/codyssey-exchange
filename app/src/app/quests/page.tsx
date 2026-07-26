import Link from "next/link";
import { mockQuests } from "@/data/mock-quests";
import { computeMetrics, isLowSample } from "@/domain/metrics";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { ChangeValue } from "@/components/ChangeValue";

export default function QuestMarketPage() {
  const rows = mockQuests
    .map((q) => ({ quest: q, metrics: computeMetrics(q) }))
    .sort((a, b) => b.metrics.bottleneckIndex - a.metrics.bottleneckIndex);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">과제 시세</h1>
          <p className="mt-1 text-sm text-neutral-500">
            전체 {mockQuests.length}개 과제 · 병목지수 높은 순 정렬 · mock 데이터
          </p>
        </div>
        <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← 시장 개요
        </Link>
      </div>

      <div className="overflow-x-auto rounded-sm border border-neutral-200">
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <thead className="sticky top-0 bg-neutral-50 text-left text-xs text-neutral-500">
            <tr className="border-b border-neutral-200">
              <th className="px-3 py-2 font-medium">과제명</th>
              <th className="px-3 py-2 font-medium">트랙</th>
              <th className="px-3 py-2 font-medium">필수</th>
              <th className="px-3 py-2 text-right font-medium">참여인원</th>
              <th className="px-3 py-2 text-right font-medium">평가대기</th>
              <th className="px-3 py-2 text-right font-medium">열린슬롯</th>
              <th className="px-3 py-2 text-right font-medium">수급비</th>
              <th className="px-3 py-2 text-right font-medium">평균대기(h)</th>
              <th className="px-3 py-2 text-right font-medium">첫시도PASS율</th>
              <th className="px-3 py-2 text-right font-medium">최근7일</th>
              <th className="px-3 py-2 text-right font-medium">병목지수</th>
              <th className="px-3 py-2 font-medium">신뢰도</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ quest: q, metrics: m }) => (
              <tr key={q.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                <td className="px-3 py-2">
                  <Link href={`/quests/${q.id}`} className="font-medium text-neutral-900 hover:underline">
                    {q.name}
                  </Link>
                  {isLowSample(q) && (
                    <span className="ml-1.5 text-[11px] text-neutral-400">표본 {q.sampleSize}건</span>
                  )}
                </td>
                <td className="px-3 py-2 text-neutral-600">{q.track}</td>
                <td className="px-3 py-2">
                  {q.required ? (
                    <span className="text-[11px] text-neutral-700">필수</span>
                  ) : (
                    <span className="text-[11px] text-neutral-400">선택</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{m.totalParticipants}</td>
                <td className="px-3 py-2 text-right tabular-nums">{q.states.evalWaiting}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {q.openSlots > 0 ? q.openSlots : <span className="text-neutral-400">미확보</span>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {m.demandSupplyRatio === null ? (
                    <span className="text-neutral-400">—</span>
                  ) : (
                    m.demandSupplyRatio.toFixed(1)
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{q.avgWaitHours}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {(q.firstAttemptPassRate * 100).toFixed(0)}%
                </td>
                <td className="px-3 py-2 text-right">
                  <ChangeValue pct={q.recentChangePct} />
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">{m.bottleneckIndex}</td>
                <td className="px-3 py-2">
                  <ConfidenceBadge level={m.bottleneckConfidence} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-neutral-400">
        수급비 = 평가대기 / 열린슬롯. 슬롯 데이터 미확보 과제는 "미확보"로 표시하며 병목지수 계산 시 관측 불가 근사치를 사용한다.
      </p>
    </main>
  );
}
