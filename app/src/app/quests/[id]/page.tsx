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
            {quest.level5Contribution && (
              <span className="rounded-sm border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[11px] text-emerald-700">
                Level 5 기여(추정)
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

      {quest.unlocks.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-medium text-neutral-700">후속 해제 과제 (트랙 내 다음 순번, 추정)</h2>
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
        상태 분포·PASS/FAIL·공식 학습시간은 codyssey_Quest_Tracker 실제 스냅샷 기준(Confirmed by API). 트랙 평균
        처리시간은 codyssey_EV_Tracker 실제 이벤트를 트랙 단위로 조인한 근사치(Observed). 후속 해제 과제는
        커리큘럼 순번 기반 추정이며 공식 의존성 API는 아직 확인되지 않았다.
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
