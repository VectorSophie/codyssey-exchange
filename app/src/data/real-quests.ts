import type { Quest } from "@/domain/quest";
import { sql } from "@/lib/db";

// 실제 데이터, Postgres 조회. scripts/refresh-quests.mjs가 매일 codyssey_Quest_Tracker(공개 저장소)
// docs/data/current.json에서 새로 받아 이 테이블을 갱신한다. 앱은 DB만 읽는다.
// - name/track/course/required/officialLearningHours/states/passCount/failCount/sampleSize: Confirmed by API
// - recentChangePct: quest_completed_history 7일 롤링 윈도 diff — Confirmed by API(관측)
// - avgWaitHours: codyssey_EV_Tracker 실제 이벤트를 같은 트랙 기준으로 평균낸 값 — 과제 단위가 아니라 트랙 단위 근사(Observed),
//   scripts/refresh-eval-aggregate.mjs가 주간 단위로 갱신한다.

interface QuestRow {
  id: string;
  name: string;
  track: string;
  course: string;
  required: boolean;
  official_learning_hours: string;
  not_started: number;
  in_progress: number;
  eval_waiting: number;
  completed: number;
  pass_count: number;
  fail_count: number;
  pass_rate: string | null;
  retry_rate: string | null;
  sample_size: number;
  recent_change_pct: string;
  avg_wait_hours: string | null;
  data_generated_at: Date;
}

function toQuest(r: QuestRow): Quest {
  return {
    id: r.id,
    name: r.name,
    track: r.track,
    course: r.course,
    required: r.required,
    officialLearningHours: Number(r.official_learning_hours),
    states: {
      notStarted: r.not_started,
      inProgress: r.in_progress,
      evalWaiting: r.eval_waiting,
      completed: r.completed,
    },
    passCount: r.pass_count,
    failCount: r.fail_count,
    passRate: r.pass_rate === null ? null : Number(r.pass_rate),
    retryRate: r.retry_rate === null ? null : Number(r.retry_rate),
    sampleSize: r.sample_size,
    recentChangePct: Number(r.recent_change_pct),
    avgWaitHours: r.avg_wait_hours === null ? null : Number(r.avg_wait_hours),
  };
}

export async function getRealQuests(): Promise<{ quests: Quest[]; dataGeneratedAt: string }> {
  const rows = await sql<QuestRow[]>`select * from quests order by id`;
  return {
    quests: rows.map(toQuest),
    dataGeneratedAt: rows[0]?.data_generated_at.toISOString() ?? new Date(0).toISOString(),
  };
}

export async function getQuestById(id: string): Promise<Quest | undefined> {
  const rows = await sql<QuestRow[]>`select * from quests where id = ${id}`;
  return rows[0] ? toQuest(rows[0]) : undefined;
}
