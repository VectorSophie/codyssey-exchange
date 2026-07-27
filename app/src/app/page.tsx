import Link from "next/link";
import { realQuests, dataGeneratedAt } from "@/data/real-quests";
import { realEvalAggregate } from "@/data/real-eval-aggregate";
import { hourlyTotals } from "@/domain/evaluation";
import { bottleneckIndex } from "@/domain/metrics";
import { ChangeValue } from "@/components/ChangeValue";
import { SupplyDemandChart } from "@/components/SupplyDemandChart";
import { QuestTicker } from "@/components/QuestTicker";

// 하루 단위로만 갱신 — "오늘의 과제"가 실제 날짜에 따라 도는 것이지 매 새로고침마다 바뀌는 가짜 실시간이 아니다.
export const revalidate = 3600;

function pickFeaturedQuest(): (typeof realQuests)[number] {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000
  );
  return realQuests[dayOfYear % realQuests.length];
}

export default function MarketOverviewPage() {
  const rows = realQuests.map((q) => ({ quest: q, bottleneck: bottleneckIndex(q) }));

  const totalWaiting = rows.reduce((sum, r) => sum + r.quest.states.evalWaiting, 0);
  const avgBottleneck = Math.round(rows.reduce((sum, r) => sum + r.bottleneck, 0) / rows.length);
  const bottleneckCount = rows.filter((r) => r.bottleneck >= 60).length;

  const topBottleneck = [...rows].sort((a, b) => b.bottleneck - a.bottleneck).slice(0, 5);
  const { demand, supply } = hourlyTotals(realEvalAggregate);

  const featured = pickFeaturedQuest();
  const topRisk = [...realQuests].sort((a, b) => bottleneckIndex(b) - bottleneckIndex(a))[0];
  const topMomentum = [...realQuests].sort((a, b) => b.recentChangePct - a.recentChangePct)[0];

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-lg font-semibold">시장 개요</h1>
      <p className="mt-1 text-sm text-neutral-500">과제 시세 수집 {dataGeneratedAt.slice(0, 10)} · 평가 시장 3개월 누적</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="전체 평가 대기(과제)" value={totalWaiting.toString()} />
        <Stat label="평가 완료 누적(3개월)" value={realEvalAggregate.totalCompleted.toLocaleString()} />
        <Stat label="평균 병목지수" value={avgBottleneck.toString()} />
        <Stat
          label="병목 과제 수 (≥60)"
          value={bottleneckCount.toString()}
          accent={bottleneckCount > 0 ? "warn" : undefined}
        />
      </div>

      <section className="mt-8 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="rounded-sm border border-border bg-surface p-5 shadow-sm lg:col-span-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-medium text-neutral-700">시간대별 수요 vs 공급</h2>
            <Link href="/eval-market" className="text-xs text-neutral-500 hover:text-neutral-900">
              평가 시장 전체 →
            </Link>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            주황 음영 = 수요 우위(부족), 초록 음영 = 공급 우위(여유)
          </p>
          <div className="mt-3">
            <SupplyDemandChart demand={demand} supply={supply} />
          </div>
          <div className="mt-2 flex gap-4 text-[11px] text-neutral-500">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-3 rounded-[1px] bg-neutral-900" /> 수요(평가 요청)
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-3 rounded-[1px] bg-neutral-400" /> 공급(완료 처리)
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <QuestTicker quest={featured} label="오늘의 과제" />
          <QuestTicker quest={topRisk} label="병목지수 1위" />
          <QuestTicker quest={topMomentum} label="최근 가장 개선됨" />
        </div>
      </section>

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
                <th className="px-3 py-2 text-right font-medium">트랙 평균처리(h)</th>
                <th className="px-3 py-2 text-right font-medium">최근변화</th>
                <th className="px-3 py-2 text-right font-medium">병목지수</th>
              </tr>
            </thead>
            <tbody>
              {topBottleneck.map(({ quest: q, bottleneck }) => (
                <tr key={q.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                  <td className="px-3 py-2">
                    <Link href={`/quests/${q.id}`} className="font-medium hover:underline">
                      {q.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{q.states.evalWaiting}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {q.avgWaitHours === null ? <span className="text-neutral-400">—</span> : q.avgWaitHours}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <ChangeValue pct={q.recentChangePct} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{bottleneck}</td>
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
