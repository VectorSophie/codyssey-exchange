#!/usr/bin/env node
// 코디세이 API에서 직접 수집해 과제 시세(quests)와 평가 시장(eval_aggregate_*)을 갱신한다. 원천이던 공개
// 트래커(codyssey_Quest_Tracker / codyssey_EV_Tracker)가 2026-08-12에 멈춰서 같은 정의로 다시 만든다(DATA.md 8절).
// 읽기 전용 — 세션 기관의 시즌 길드 전원에 대해:
//   1) guild/{id}/detail → mbrId만
//   2) ev/request/mbrSearch/searchList → 과제별 최신 행으로 상태(N/M/E/C)·PASS/FAIL
//   3) 최근 90일 평가마다 ev/request/mtlEvlTxnDtoByPkList → 요청시각(regDt)·실제 시작시각·상태·트랙만
// 응답에 실명이 들어 있지만(길드 멤버, 평가자) 읽지 않고 버린다. 개인별 행은 저장하지 않고 집계만 DB에 쓴다.
// 실행: npm run collect (app/.env.local의 CODYSSEY_SESSION, DATABASE_URL) · --dry-run이면 DB에 쓰지 않고 출력만.
import postgres from "postgres";
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_BASE = "https://api.usr.codyssey.kr/";
const DELAY_MS = 120;
const WINDOW_DAYS = 90; // 예전 EV Tracker 3개월 집계와 같은 폭
const HISTORY_WINDOW_DAYS = 7;
const HISTORY_RETENTION_DAYS = 35;
const DRY_RUN = process.argv.includes("--dry-run");

function loadEnv() {
  for (const name of [".env.local", ".env"]) {
    const envPath = join(__dirname, "..", name);
    if (!existsSync(envPath)) continue;
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1");
    }
  }
}
loadEnv();

const SESSION = process.env.CODYSSEY_SESSION;
if (!SESSION) {
  console.error("CODYSSEY_SESSION이 설정되지 않았습니다 — 로그인 쿠키 문자열을 app/.env.local에 넣으세요.");
  process.exit(1);
}
if (!DRY_RUN && !process.env.DATABASE_URL) {
  console.error("DATABASE_URL이 설정되지 않았습니다 — app/.env.local에 추가하세요.");
  process.exit(1);
}
const XSRF = (SESSION.match(/XSRF-TOKEN=([^;]+)/) || [])[1] ?? "";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(path, form) {
  const res = await fetch(API_BASE + path, {
    method: form ? "POST" : "GET",
    headers: form
      ? {
          Cookie: SESSION,
          "X-XSRF-TOKEN": XSRF,
          "X-Requested-With": "XMLHttpRequest",
          "Content-Type": "application/x-www-form-urlencoded",
        }
      : { Cookie: SESSION },
    body: form ? new URLSearchParams(form) : undefined,
    redirect: "manual", // 만료 세션은 302 → /login
    signal: AbortSignal.timeout(20000),
  });
  if (res.status >= 300 && res.status < 400) throw new Error("세션 만료(302 → /login) — 새 쿠키를 넣으세요.");
  if (!res.ok) throw new Error(`${path} 실패: HTTP ${res.status}`);
  const body = await res.json();
  if (body.code !== 200) throw new Error(`${path} 실패: code ${body.code} ${body.message ?? ""}`);
  return body.result;
}
const list = (r) => (Array.isArray(r) ? r : (r?.list ?? []));

// "2026-10-11 12:54:21" (KST 벽시계) → { ms, day, hour }. 시스템 타임존에 의존하지 않도록 문자열에서 직접 뽑는다.
function kst(s) {
  const m = String(s ?? "").match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):?(\d{2})?/);
  if (!m) return null;
  const [, y, mo, d, h, mi, se] = m.map(Number);
  return { ms: Date.UTC(y, mo - 1, d, h - 9, mi, se || 0), day: new Date(Date.UTC(y, mo - 1, d)).getUTCDay(), hour: h };
}

// 예전 Quest Tracker 정의(lib/progress-core.cjs): 행 없음 N 미시작 / 00001 M 미진행 / 00002 E 평가중 / 00003 C 완료.
const baseStatus = (cd) => (cd === "00003" ? "C" : cd === "00002" ? "E" : "M");
// 예전 EV Tracker 정의: 상세 행의 한글 상태명 기준.
function evStatus(nm) {
  const t = String(nm ?? "");
  if (t.includes("완료")) return "COMPLETED";
  if (t.includes("취소") || t.includes("거절")) return "CANCELLED";
  if (t.includes("진행")) return "IN_PROGRESS";
  return "REQUESTED";
}

async function main() {
  const season = await call("guild/season/currentSeasonDetail");
  const weekly = await call(
    `guild/ranking/weeklyList?guildSeasonId=${season.guildSeasonId}&weekNo=${season.currentWeekNo}`
  );
  const mbrIds = new Set();
  for (const { guildId } of weekly.rankings) {
    const detail = await call(
      `guild/${guildId}/detail?guildSeasonId=${season.guildSeasonId}&weekNo=${season.currentWeekNo}`
    );
    for (const m of detail.members) mbrIds.add(String(m.mbrId));
    await sleep(DELAY_MS);
  }
  console.log(`${season.seasonNm} ${season.currentWeekNo}주차 · 길드 ${weekly.rankings.length}개 · ${mbrIds.size}명`);

  const sinceMs = Date.now() - WINDOW_DAYS * 86_400_000;
  const quest = new Map(); // uqstnNo → {N,M,E,C,pass,fail} — N은 마지막에 (총원 − 행 있는 사람)으로 채운다
  const toFetch = []; // [evlNo, evlDegr, lcorsNm]
  for (const mbrId of mbrIds) {
    const rows = list(
      await call("ev/request/mbrSearch/searchList", {
        mbrId, instCd: "00021", page: "1", pagePerRows: "200", orderBy: "DESC",
      })
    );
    const seen = new Set();
    for (const r of rows) {
      const no = String(r.uqstnNo ?? "");
      if (no && !seen.has(no)) {
        seen.add(no); // DESC라 첫 행이 최신 — 예전 트래커는 마지막(=가장 오래된) 행이 이겼다
        const q = quest.get(no) ?? { N: 0, M: 0, E: 0, C: 0, pass: 0, fail: 0 };
        const st = baseStatus(String(r.evlStusCd));
        q[st]++;
        if (st === "C") q[r.passedYn === "Y" ? "pass" : "fail"]++;
        quest.set(no, q);
      }
      // 끝난 지 90일 넘은 평가는 상세를 건너뛴다(그 안의 세션도 전부 창 밖) — 진행 중이면 끝 시각이 없다
      const ended = kst(r.evlEndDt);
      if (!ended || ended.ms >= sinceMs) toFetch.push([r.evlNo, r.evlDegr, r.lcorsNm ?? ""]);
    }
    await sleep(DELAY_MS);
  }
  for (const q of quest.values()) q.N = mbrIds.size - q.M - q.E - q.C;
  // 아직 열린 평가(대기중/진행중)는 상세에 끝난 세션만 나와서, 열린 요청 수는 목록 상태로 센다
  const openRequested = [...quest.values()].reduce((s, q) => s + q.M, 0);
  const openInProgress = [...quest.values()].reduce((s, q) => s + q.E, 0);

  const events = new Map(); // mtlEvlSn → {requested, slot, status, track}
  for (const [evlNo, evlDegr, track] of toFetch) {
    for (const t of list(await call("ev/request/mtlEvlTxnDtoByPkList", { evlNo, evlDegr }))) {
      const requested = kst(t.regDt);
      if (!requested || requested.ms < sinceMs) continue;
      events.set(String(t.mtlEvlSn ?? `${evlNo}-${evlDegr}-${t.regDt}`), {
        requested,
        slot: kst(t.mtlEvlBgngDt) ?? kst(t.mtlEvlPamBgngDt),
        status: evStatus(t.mtlEvlStusNm),
        track,
      });
    }
    await sleep(DELAY_MS);
  }

  // 평가 시장: 수요 = 완료·취소된 요청의 요청 시각, 공급 = 완료된 평가의 실제 시작 시각(열린 슬롯 API가 없어 처리량으로 근사)
  const demand = Array.from({ length: 7 }, () => Array(24).fill(0));
  const supply = Array.from({ length: 7 }, () => Array(24).fill(0));
  const waits = {};
  const totals = { COMPLETED: 0, CANCELLED: 0 };
  for (const e of events.values()) {
    if (e.status in totals) totals[e.status]++;
    if (e.status === "COMPLETED" || e.status === "CANCELLED") demand[e.requested.day][e.requested.hour]++;
    if (e.status === "COMPLETED" && e.slot) {
      supply[e.slot.day][e.slot.hour]++;
      (waits[e.track] ??= []).push((e.slot.ms - e.requested.ms) / 3_600_000);
    }
  }
  const avgWaitByTrack = Object.fromEntries(
    Object.entries(waits).map(([t, h]) => [t, Math.round((h.reduce((a, b) => a + b, 0) / h.length) * 10) / 10])
  );

  console.log(`평가 ${toFetch.length}건 상세 조회 → 최근 ${WINDOW_DAYS}일 세션 ${events.size}건`, totals, { openRequested, openInProgress });
  if (DRY_RUN) {
    for (const [no, q] of [...quest].sort()) console.log(no, JSON.stringify(q));
    console.log("트랙 평균 처리시간(h)", avgWaitByTrack);
    return;
  }

  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  const capturedAt = new Date();
  await sql.begin(async (tx) => {
    for (const { id } of await tx`select id from quests`) {
      const q = quest.get(id.slice(1)) ?? { N: mbrIds.size, M: 0, E: 0, C: 0, pass: 0, fail: 0 };
      const passFail = q.pass + q.fail;
      await tx`
        insert into quest_completed_history (quest_id, captured_at, completed)
        values (${id}, ${capturedAt}, ${q.C})
      `;
      const [prev] = await tx`
        select completed from quest_completed_history
        where quest_id = ${id} and captured_at <= ${capturedAt} - interval '1 day' * ${HISTORY_WINDOW_DAYS}
        order by captured_at desc limit 1
      `;
      const recentChangePct =
        prev === undefined ? 0 : prev.completed > 0 ? Math.round(((q.C - prev.completed) / prev.completed) * 1000) / 10 : q.C > 0 ? 100 : 0;
      await tx`
        update quests set
          not_started = ${q.N}, in_progress = ${q.M}, eval_waiting = ${q.E}, completed = ${q.C},
          pass_count = ${q.pass}, fail_count = ${q.fail},
          pass_rate = ${passFail ? q.pass / passFail : null}, retry_rate = ${passFail ? q.fail / passFail : null},
          sample_size = ${mbrIds.size}, recent_change_pct = ${recentChangePct}, data_generated_at = ${capturedAt}
        where id = ${id}
      `;
    }
    await tx`delete from quest_completed_history where captured_at < ${capturedAt} - interval '1 day' * ${HISTORY_RETENTION_DAYS}`;

    await tx`delete from eval_aggregate_meta`;
    await tx`
      insert into eval_aggregate_meta (
        id, source, generated_at, total_events, total_completed, total_cancelled, total_requested, total_in_progress, day_labels
      ) values (
        true, ${`코디세이 API 직접 수집 — ${season.seasonNm} 길드 ${mbrIds.size}명, 최근 ${WINDOW_DAYS}일 (집계만)`}, ${capturedAt},
        ${events.size}, ${totals.COMPLETED}, ${totals.CANCELLED}, ${openRequested}, ${openInProgress},
        ${["일", "월", "화", "수", "목", "금", "토"]}
      )
    `;
    await tx`delete from eval_aggregate_cells`;
    for (let d = 0; d < 7; d++)
      for (let h = 0; h < 24; h++)
        await tx`insert into eval_aggregate_cells (day_of_week, hour, demand, supply) values (${d}, ${h}, ${demand[d][h]}, ${supply[d][h]})`;
    await tx`update quests set avg_wait_hours = null`;
    for (const [track, hours] of Object.entries(avgWaitByTrack))
      await tx`update quests set avg_wait_hours = ${hours} where track = ${track}`;
  });
  await sql.end();
  console.log("DB 갱신 완료");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
