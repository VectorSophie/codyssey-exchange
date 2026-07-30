#!/usr/bin/env node
// 매주 실행: codyssey_EV_Tracker(공개 저장소)의 최근 3개월치 월별 파일에서 이벤트를 새로 받아
// 평가 시장 집계(시간대x요일 수요/공급)와 과제별 트랙 평균 처리시간(avg_wait_hours)을 갱신한다.
// 원본 이벤트에는 평가자/피평가자 실명이 있다 — 집계 수치만 만들고 원본은 어디에도 저장하지 않는다
// (docs/privacy-threat-model.md). 일별 과제 갱신(refresh-quests.mjs)과는 별도 소스라 주기가 다르다.
// 실행: npm run refresh:eval (app/.env.local의 DATABASE_URL을 자동으로 읽는다)
import postgres from "postgres";
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_BASE = "https://raw.githubusercontent.com/giyeop-cody/codyssey_EV_Tracker/main/docs/data";
const MONTHS_BACK = 3;

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

// 타임스탬프 문자열이 이미 KST(+09:00) 벽시계 값이므로, 시스템 타임존에 의존하지 않도록
// 문자열에서 직접 날짜/시각을 뽑아 요일을 계산한다.
function kstParts(iso) {
  const [datePart, timePart] = iso.split("T");
  const hour = Number(timePart.slice(0, 2));
  const [y, m, d] = datePart.split("-").map(Number);
  const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { dayOfWeek, hour };
}

function targetMonths() {
  const months = [];
  const now = new Date();
  for (let i = 0; i < MONTHS_BACK; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

async function main() {
  const months = targetMonths();
  let events = [];
  for (const month of months) {
    const res = await fetch(`${REPO_BASE}/${month}.json`);
    if (!res.ok) {
      console.warn(`${month}.json 없음(HTTP ${res.status}) — 건너뜀`);
      continue;
    }
    const data = await res.json();
    events = events.concat(data.events ?? []);
  }
  if (events.length === 0) throw new Error("이벤트를 하나도 받지 못했다 — 소스 저장소 경로를 확인하세요.");

  const totalEvents = events.length;
  const totalCompleted = events.filter((e) => e.status === "COMPLETED").length;
  const totalCancelled = events.filter((e) => e.status === "CANCELLED").length;
  const totalRequested = events.filter((e) => e.status === "REQUESTED").length;
  const totalInProgress = events.filter((e) => e.status === "IN_PROGRESS").length;

  const demandByDayHour = Array.from({ length: 7 }, () => Array(24).fill(0));
  const supplyByDayHour = Array.from({ length: 7 }, () => Array(24).fill(0));

  for (const e of events) {
    // 수요 = 해결된(완료/취소) 요청의 "요청 시각" 분포 — 아직 열려있는 요청은 시간대 패턴에서 제외
    if (e.status === "COMPLETED" || e.status === "CANCELLED") {
      const { dayOfWeek, hour } = kstParts(e.requestedAt);
      demandByDayHour[dayOfWeek][hour]++;
    }
    // 공급 = 완료 처리된 "실제 처리 시각(slotDateTime)" 분포 — 열린 슬롯 데이터가 없어 완료 처리량으로 근사
    if (e.status === "COMPLETED") {
      const { dayOfWeek, hour } = kstParts(e.slotDateTime);
      supplyByDayHour[dayOfWeek][hour]++;
    }
  }

  const waitHoursByTrack = {};
  for (const e of events) {
    if (e.status !== "COMPLETED") continue;
    const hrs = (new Date(e.slotDateTime).getTime() - new Date(e.requestedAt).getTime()) / 3_600_000;
    (waitHoursByTrack[e.trackName] ??= []).push(hrs);
  }
  const avgWaitByTrack = Object.fromEntries(
    Object.entries(waitHoursByTrack).map(([track, hrs]) => [
      track,
      Math.round((hrs.reduce((a, b) => a + b, 0) / hrs.length) * 10) / 10,
    ])
  );

  const generatedAt = new Date();
  const dayLabels = ["일", "월", "화", "수", "목", "금", "토"];

  await sql.begin(async (tx) => {
    await tx`delete from eval_aggregate_meta`;
    await tx`
      insert into eval_aggregate_meta (
        id, source, generated_at, total_events, total_completed,
        total_cancelled, total_requested, total_in_progress, day_labels
      ) values (
        true, ${`codyssey_EV_Tracker (public) ${months[months.length - 1]}~${months[0]} — PII 제거, 집계만`},
        ${generatedAt}, ${totalEvents}, ${totalCompleted}, ${totalCancelled}, ${totalRequested}, ${totalInProgress},
        ${dayLabels}
      )
    `;

    await tx`delete from eval_aggregate_cells`;
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        await tx`
          insert into eval_aggregate_cells (day_of_week, hour, demand, supply)
          values (${d}, ${h}, ${demandByDayHour[d][h]}, ${supplyByDayHour[d][h]})
        `;
      }
    }

    for (const [track, avgHours] of Object.entries(avgWaitByTrack)) {
      await tx`update quests set avg_wait_hours = ${avgHours} where track = ${track}`;
    }
  });

  console.log(
    `평가 시장 집계 갱신 완료: ${months.join(", ")} · 이벤트 ${totalEvents}건 · 트랙 ${Object.keys(avgWaitByTrack).length}개 평균처리시간 반영`
  );
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
