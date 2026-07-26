import Link from "next/link";
import { mockQuests } from "@/data/mock-quests";
import { computeMetrics } from "@/domain/metrics";
import { ChangeValue } from "@/components/ChangeValue";

export default function MarketOverviewPage() {
  const rows = mockQuests.map((q) => ({ quest: q, metrics: computeMetrics(q) }));

  const totalWaiting = rows.reduce((sum, r) => sum + r.quest.states.evalWaiting, 0);
  const totalSlots = rows.reduce((sum, r) => sum + r.quest.openSlots, 0);
  const avgBottleneck = Math.round(
    rows.reduce((sum, r) => sum + r.metrics.bottleneckIndex, 0) / rows.length
  );
  const bottleneckCount = rows.filter((r) => r.metrics.bottleneckIndex >= 60).length;

  const topBottleneck = [...rows].sort((a, b) => b.metrics.bottleneckIndex - a.metrics.bottleneckIndex).slice(0, 5);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-lg font-semibold">시장 개요</h1>
      <p className="mt-1 text-sm text-neutral-500">
        mock 데이터 기준 · 실제 화폐·투자수익률을 다루지 않는 학습 활동 분석 도구입니다.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="전체 평가 대기" value={totalWaiting.toString()} />
        <Stat label="전체 열린 슬롯" value={totalSlots.toString()} />
        <Stat label="평균 병목지수" value={avgBottleneck.toString()} />
        <Stat label="병목 과제 수 (≥60)" value={bottleneckCount.toString()} accent={bottleneckCount > 0 ? "warn" : undefined} />
      </div>

      <section className="mt-8">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-neutral-700">병목지수 상위 과제</h2>
          <Link href="/quests" className="text-xs text-neutral-500 hover:text-neutral-900">
            전체 과제 시세 →
          </Link>
        </div>
        <div className="overflow-hidden rounded-sm border border-border bg-surface shadow-sm">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
              <tr className="border-b border-neutral-200">
                <th className="px-3 py-2 font-medium">과제명</th>
                <th className="px-3 py-2 text-right font-medium">평가대기</th>
                <th className="px-3 py-2 text-right font-medium">평균대기(h)</th>
                <th className="px-3 py-2 text-right font-medium">최근7일</th>
                <th className="px-3 py-2 text-right font-medium">병목지수</th>
              </tr>
            </thead>
            <tbody>
              {topBottleneck.map(({ quest: q, metrics: m }) => (
                <tr key={q.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                  <td className="px-3 py-2">
                    <Link href={`/quests/${q.id}`} className="font-medium hover:underline">
                      {q.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{q.states.evalWaiting}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{q.avgWaitHours}</td>
                  <td className="px-3 py-2 text-right">
                    <ChangeValue pct={q.recentChangePct} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{m.bottleneckIndex}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "warn" }) {
  return (
    <div className="rounded-sm border border-border bg-surface px-4 py-4 shadow-sm">
      <div className="text-xs text-neutral-500">{label}</div>
      <div
        className={`mt-1 text-xl font-semibold tabular-nums ${
          accent === "warn" ? "text-amber-600" : "text-neutral-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
