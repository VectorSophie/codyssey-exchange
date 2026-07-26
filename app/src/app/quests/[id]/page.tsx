import Link from "next/link";
import { notFound } from "next/navigation";
import { getQuestById, mockQuests } from "@/data/mock-quests";
import { computeMetrics, isLowSample } from "@/domain/metrics";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { ChangeValue } from "@/components/ChangeValue";

const STATE_LABEL: Record<string, string> = {
  notStarted: "미진행",
  inProgress: "진행중",
  evalWaiting: "평가 대기",
  evalScheduled: "평가 예정",
  completed: "완료",
  reEval: "재평가",
};

export function generateStaticParams() {
  return mockQuests.map((q) => ({ id: q.id }));
}

export default async function QuestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quest = getQuestById(id);
  if (!quest) notFound();

  const metrics = computeMetrics(quest);
  const stateEntries = Object.entries(quest.states) as [keyof typeof STATE_LABEL, number][];

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <Link href="/quests" className="text-sm text-neutral-500 hover:text-neutral-900">
        ← 과제 시세
      </Link>

      <div className="mt-3 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-neutral-900">{quest.name}</h1>
            {quest.required && (
              <span className="rounded-sm border border-neutral-300 px-1.5 py-0.5 text-[11px] text-neutral-600">
                필수
              </span>
            )}
            {quest.level5Contribution && (
              <span className="rounded-sm border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[11px] text-emerald-700">
                Level 5 기여
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-neutral-500">{quest.track}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold tabular-nums text-neutral-900">{metrics.bottleneckIndex}</div>
          <div className="text-xs text-neutral-500">병목지수</div>
          <div className="mt-1">
            <ConfidenceBadge level={metrics.bottleneckConfidence} />
          </div>
        </div>
      </div>

      {isLowSample(quest) && (
        <div className="mt-4 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          표본 수 {quest.sampleSize}건 — 최소 신뢰 표본(10건) 미만이므로 이 과제의 지표는 참고용으로만 사용한다.
        </div>
      )}

      <section className="mt-6">
        <h2 className="text-sm font-medium text-neutral-700">상태 분포</h2>
        <div className="mt-2 grid grid-cols-3 gap-px overflow-hidden rounded-sm border border-border bg-border shadow-sm sm:grid-cols-6">
          {stateEntries.map(([key, value]) => (
            <div key={key} className="bg-surface px-3 py-3 text-center">
              <div className="text-lg font-semibold tabular-nums text-neutral-900">{value}</div>
              <div className="mt-0.5 text-[11px] text-neutral-500">{STATE_LABEL[key]}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-border bg-border shadow-sm sm:grid-cols-4">
        <Metric label="참여 인원" value={metrics.totalParticipants.toString()} />
        <Metric
          label="수급비"
          value={metrics.demandSupplyRatio === null ? "미확보" : metrics.demandSupplyRatio.toFixed(1)}
        />
        <Metric label="평균 평가대기" value={`${quest.avgWaitHours}h`} />
        <Metric label="평균 완료시간" value={`${quest.avgCompletionHours}h`} />
        <Metric label="첫시도 PASS율" value={`${(quest.firstAttemptPassRate * 100).toFixed(0)}%`} />
        <Metric label="재평가율" value={`${(quest.retryRate * 100).toFixed(0)}%`} />
        <Metric label="열린 슬롯" value={quest.openSlots > 0 ? quest.openSlots.toString() : "미확보"} />
        <Metric label="표본 크기" value={`${quest.sampleSize}건`} />
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-medium text-neutral-700">최근 7일 변화</h2>
        <p className="mt-2 text-sm">
          완료 증가율 <ChangeValue pct={quest.recentChangePct} />
        </p>
      </section>

      {quest.unlocks.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-medium text-neutral-700">후속 해제 과제</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {quest.unlocks.map((uid) => {
              const u = getQuestById(uid);
              return (
                <li key={uid}>
                  <Link
                    href={`/quests/${uid}`}
                    className="rounded-sm border border-neutral-200 px-2 py-1 text-xs text-neutral-700 hover:border-neutral-400"
                  >
                    {u?.name ?? uid}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <p className="mt-8 text-xs text-neutral-400">
        데이터 등급: {quest.confidence === "confirmed_api" ? "공식 API 확인" : "관측/추정 포함"} · mock 데이터 기준
      </p>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface px-3 py-3">
      <div className="text-[11px] text-neutral-500">{label}</div>
      <div className="mt-0.5 text-base font-semibold tabular-nums text-neutral-900">{value}</div>
    </div>
  );
}
