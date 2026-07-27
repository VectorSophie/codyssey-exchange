import Link from "next/link";
import { notFound } from "next/navigation";
import { getQuestById, realQuests } from "@/data/real-quests";
import { bottleneckIndex, bottleneckConfidence, totalParticipants, isLowSample } from "@/domain/metrics";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { ChangeValue } from "@/components/ChangeValue";

const STATE_LABEL: Record<string, string> = {
  notStarted: "미진행",
  inProgress: "진행중",
  evalWaiting: "평가 대기",
  completed: "완료",
};

export function generateStaticParams() {
  return realQuests.map((q) => ({ id: q.id }));
}

export default async function QuestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quest = getQuestById(id);
  if (!quest) notFound();

  const bottleneck = bottleneckIndex(quest);
  const confidence = bottleneckConfidence(quest);
  const participants = totalParticipants(quest);
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
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            {quest.course} · {quest.track}
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold tabular-nums text-neutral-900">{bottleneck}</div>
          <div className="text-xs text-neutral-500">병목지수</div>
          <div className="mt-1">
            <ConfidenceBadge level={confidence} />
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
        <div className="mt-2 flex h-3 overflow-hidden rounded-[2px]">
          <div className="bg-neutral-200" style={{ width: `${(quest.states.notStarted / participants) * 100}%` }} />
          <div className="bg-blue-400" style={{ width: `${(quest.states.inProgress / participants) * 100}%` }} />
          <div className="bg-amber-400" style={{ width: `${(quest.states.evalWaiting / participants) * 100}%` }} />
          <div className="bg-emerald-500" style={{ width: `${(quest.states.completed / participants) * 100}%` }} />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-border bg-border shadow-sm sm:grid-cols-4">
          {stateEntries.map(([key, value]) => (
            <div key={key} className="bg-surface px-3 py-3 text-center">
              <div className="text-lg font-semibold tabular-nums text-neutral-900">{value}</div>
              <div className="mt-0.5 text-[11px] text-neutral-500">{STATE_LABEL[key]}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-border bg-border shadow-sm sm:grid-cols-4">
        <Metric label="참여 인원" value={participants.toString()} />
        <Metric
          label="트랙 평균 처리시간"
          value={quest.avgWaitHours === null ? "데이터 없음" : `${quest.avgWaitHours}h`}
        />
        <Metric label="공식 학습시간" value={`${quest.officialLearningHours}h`} />
        <Metric
          label="평가 PASS율"
          value={quest.passRate === null ? "표본 없음" : `${(quest.passRate * 100).toFixed(0)}%`}
        />
        <Metric
          label="재평가율"
          value={quest.retryRate === null ? "표본 없음" : `${(quest.retryRate * 100).toFixed(0)}%`}
        />
        <Metric label="PASS/FAIL" value={`${quest.passCount} / ${quest.failCount}`} />
        <Metric label="표본 크기" value={`${quest.sampleSize}건`} />
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-medium text-neutral-700">최근 변화(약 6일 간격 스냅샷 비교)</h2>
        <p className="mt-2 text-sm">
          완료 건수 변화 <ChangeValue pct={quest.recentChangePct} />
        </p>
      </section>

      <p className="mt-8 text-xs text-neutral-400">과제 간 선행조건은 없다 — 순서 없이 자유롭게 선택할 수 있다.</p>
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
