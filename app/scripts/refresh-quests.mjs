#!/usr/bin/env node
// 매일 실행: codyssey_Quest_Tracker(공개 저장소) docs/data/current.json에서 과제 카탈로그/상태 분포를
// 새로 받아 Postgres에 반영한다. avg_wait_hours는 여기서 건드리지 않는다 — refresh-eval-aggregate.mjs가
// 주간 단위로 트랙 평균 처리시간을 계산해 넣는다(서로 다른 소스, 서로 다른 주기).
// 실행: npm run refresh:quests (app/.env.local의 DATABASE_URL을 자동으로 읽는다)
import postgres from "postgres";
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_URL = "https://raw.githubusercontent.com/giyeop-cody/codyssey_Quest_Tracker/main/docs/data/current.json";
const HISTORY_WINDOW_DAYS = 7; // README에서 제안한 "7일 롤링 윈도" 그대로 채택
const HISTORY_RETENTION_DAYS = 35;

function loadEnv() {
  for (const name of [".env.local", ".env"]) {
    const envPath = join(__dirname, "..", name);
    if (!existsSync(envPath)) continue;
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  }
}
loadEnv();

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL이 설정되지 않았습니다 — app/.env.local에 추가하세요.");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

async function main() {
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`과제 카탈로그 수집 실패: HTTP ${res.status}`);
  const raw = await res.json();

  const generatedAt = raw.meta.generatedAt;
  const capturedAt = new Date();

  await sql.begin(async (tx) => {
    for (const a of raw.assignments) {
      const agg = raw.aggregates[a.uqstnNo]?.ALL;
      if (!agg) continue; // 마스터엔 있지만 집계가 없는 과제(신규 등록 직후 등) — 다음 회차에 자연 반영

      const passFail = agg.pass + agg.fail;
      const passRate = passFail > 0 ? agg.pass / passFail : null;
      const retryRate = passFail > 0 ? agg.fail / passFail : null;
      const officialLearningHours = Math.round((a.learningTm / 60) * 10) / 10;
      const id = `q${a.uqstnNo}`;

      // 완료건수 이력 적재 → 7일 전 대비 변화율 계산
      await tx`
        insert into quest_completed_history (quest_id, captured_at, completed)
        values (${id}, ${capturedAt}, ${agg.C})
        on conflict (quest_id, captured_at) do nothing
      `;
      const [prev] = await tx`
        select completed from quest_completed_history
        where quest_id = ${id}
          and captured_at <= ${capturedAt} - interval '1 day' * ${HISTORY_WINDOW_DAYS}
        order by captured_at desc
        limit 1
      `;
      const recentChangePct =
        prev === undefined
          ? 0 // 7일치 이력이 아직 없음(초기 도입 직후) — 다음 회차부터 실제 값이 채워진다
          : prev.completed > 0
            ? Math.round(((agg.C - prev.completed) / prev.completed) * 1000) / 10
            : agg.C > 0
              ? 100
              : 0;

      await tx`
        insert into quests (
          id, name, track, course, required, official_learning_hours,
          not_started, in_progress, eval_waiting, completed,
          pass_count, fail_count, pass_rate, retry_rate, sample_size,
          recent_change_pct, avg_wait_hours, data_generated_at
        ) values (
          ${id}, ${a.uqstnNm}, ${a.lcorsNm}, ${a.courseNm}, ${a.requiredYn === "Y"}, ${officialLearningHours},
          ${agg.N}, ${agg.M}, ${agg.E}, ${agg.C},
          ${agg.pass}, ${agg.fail}, ${passRate}, ${retryRate}, ${agg.total},
          ${recentChangePct}, null, ${generatedAt}
        )
        on conflict (id) do update set
          name = excluded.name,
          track = excluded.track,
          course = excluded.course,
          required = excluded.required,
          official_learning_hours = excluded.official_learning_hours,
          not_started = excluded.not_started,
          in_progress = excluded.in_progress,
          eval_waiting = excluded.eval_waiting,
          completed = excluded.completed,
          pass_count = excluded.pass_count,
          fail_count = excluded.fail_count,
          pass_rate = excluded.pass_rate,
          retry_rate = excluded.retry_rate,
          sample_size = excluded.sample_size,
          recent_change_pct = excluded.recent_change_pct,
          data_generated_at = excluded.data_generated_at
          -- avg_wait_hours는 의도적으로 갱신하지 않음(refresh-eval-aggregate.mjs 소유)
      `;
    }

    await tx`
      delete from quest_completed_history
      where captured_at < ${capturedAt} - interval '1 day' * ${HISTORY_RETENTION_DAYS}
    `;
  });

  console.log(`과제 카탈로그 갱신 완료: ${raw.assignments.length}건, 수집 시각 ${generatedAt}`);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
