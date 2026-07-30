#!/usr/bin/env node
// db/schema.sql을 적용하고 db/seed/*.json(현재 커밋된 실제 데이터 스냅샷)을 Postgres에 채운다.
// 실행: npm run db:seed (app/.env.local의 DATABASE_URL을 자동으로 읽는다)
import postgres from "postgres";
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");

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
  const schema = readFileSync(join(ROOT, "db", "schema.sql"), "utf8");
  await sql.unsafe(schema);

  const questsData = JSON.parse(readFileSync(join(ROOT, "db", "seed", "quests.json"), "utf8"));
  const evalData = JSON.parse(readFileSync(join(ROOT, "db", "seed", "eval-aggregate.json"), "utf8"));

  await sql.begin(async (tx) => {
    await tx`delete from quests`;
    for (const q of questsData.quests) {
      await tx`
        insert into quests (
          id, name, track, course, required, official_learning_hours,
          not_started, in_progress, eval_waiting, completed,
          pass_count, fail_count, pass_rate, retry_rate, sample_size,
          recent_change_pct, avg_wait_hours, data_generated_at
        ) values (
          ${q.id}, ${q.name}, ${q.track}, ${q.course}, ${q.required}, ${q.officialLearningHours},
          ${q.states.notStarted}, ${q.states.inProgress}, ${q.states.evalWaiting}, ${q.states.completed},
          ${q.passCount}, ${q.failCount}, ${q.passRate}, ${q.retryRate}, ${q.sampleSize},
          ${q.recentChangePct}, ${q.avgWaitHours}, ${questsData.dataGeneratedAt}
        )
      `;
    }

    await tx`delete from eval_aggregate_meta`;
    await tx`
      insert into eval_aggregate_meta (
        id, source, generated_at, total_events, total_completed,
        total_cancelled, total_requested, total_in_progress, day_labels
      ) values (
        true, ${evalData.source}, ${evalData.generatedAt}, ${evalData.totalEvents}, ${evalData.totalCompleted},
        ${evalData.totalCancelled}, ${evalData.totalRequested}, ${evalData.totalInProgress}, ${evalData.dayLabels}
      )
    `;

    await tx`delete from eval_aggregate_cells`;
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        await tx`
          insert into eval_aggregate_cells (day_of_week, hour, demand, supply)
          values (${d}, ${h}, ${evalData.demandByDayHour[d][h]}, ${evalData.supplyByDayHour[d][h]})
        `;
      }
    }
  });

  console.log(`시드 완료: quests ${questsData.quests.length}건, eval_aggregate_cells 168셀`);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
