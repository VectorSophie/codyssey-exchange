import Link from "next/link";
import { mockQuests } from "@/data/mock-quests";
import { mockMember } from "@/data/mock-member";
import { questStatus, NODE_STATUS_LABEL, type NodeStatus } from "@/domain/progress";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";

const STATUS_STYLE: Record<NodeStatus, string> = {
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  in_progress: "border-blue-200 bg-blue-50 text-blue-700",
  available: "border-neutral-300 bg-white text-neutral-700",
  locked: "border-neutral-200 bg-neutral-100 text-neutral-400",
  unknown: "border-violet-200 bg-violet-50 text-violet-700",
};

export default function LevelExamPage() {
  const member = mockMember;
  const nodes = mockQuests.map((q) => ({ quest: q, status: questStatus(q, member, mockQuests) }));

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-lg font-semibold">레벨과 시험</h1>
      <p className="mt-1 text-sm text-neutral-500">mock 데이터 · 실제 Codyssey 세션 관찰 기준(2026-07-26) 필드 신뢰도 반영</p>

      <section className="mt-6 rounded-sm border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-semibold tabular-nums">Lv.{member.level}</div>
            <div className="mt-1 text-sm text-neutral-500">경험치 {member.exp.toLocaleString()}</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium">Level 5 시험 응시 가능 여부</div>
            <div className="mt-1 flex items-center justify-end gap-2">
              <span className={member.level5ExamEligible ? "text-emerald-600" : "text-amber-600"}>
                {member.level5ExamEligible ? "가능" : "조건 미충족(추정)"}
              </span>
              <ConfidenceBadge level={member.level5ExamConfidence} />
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-neutral-400">
          실제 계정 관찰 결과 시험 접수 API(<code>POST /exam/usr/list</code>)는 응답에 "다음 레벨 조건"을 직접 명시하는 필드가 없어,
          남은 Level5 기여 과제 완료 여부로 근사한다. 공식 조건 필드를 찾기 전까지 이 판정은 inferred다.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-neutral-700">조건 그래프</h2>
        <p className="mt-1 text-xs text-neutral-500">
          완료 / 진행중 / 실행가능 / 잠김 / 조건 미확인 — Codyssey 학습맵 화면(헥사곤 노드)의 상태 구분을 참고해 구성.
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
        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-neutral-500">
          {(Object.keys(NODE_STATUS_LABEL) as NodeStatus[]).map((s) => (
            <span key={s} className="flex items-center gap-1">
              <span className={`inline-block h-2.5 w-2.5 rounded-[1px] border ${STATUS_STYLE[s]}`} />
              {NODE_STATUS_LABEL[s]}
            </span>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-neutral-700">시험 접수/결과</h2>
        <p className="mt-2 text-sm text-neutral-500">
          실제 계정 관찰 결과: <code>시험 → 접수</code> 화면 응시 가능 시험 0건("응시할 시험이 없습니다"),{" "}
          <code>시험 → 결과</code> 화면 응시 이력 0건. mock 데이터에서도 동일하게 비워둔다 — 없는 데이터를 지어내지 않는다.
        </p>
        <div className="mt-3 rounded-sm border border-dashed border-neutral-300 bg-surface px-4 py-6 text-center text-sm text-neutral-400">
          응시 가능한 시험이 없습니다
        </div>
      </section>
    </main>
  );
}
