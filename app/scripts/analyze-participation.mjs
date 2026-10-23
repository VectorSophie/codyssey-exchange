#!/usr/bin/env node
// 우수 교육생 선정 신호 조사(DATA.md 12절)를 재현하는 오프라인 분석. 코디세이 API를 호출하지 않고, DB에도 쓰지 않는다.
//   credit <파일>     본인 크레딧 원장(point/credit/list의 result.list를 저장한 JSON 배열)을 사건 단위로 묶어
//                      타임라인·일/주/월 요약·소급 적립·공백·받은 세션 하한을 출력한다. 본인 기록만 넣는다 — 파일은 저장소에 두지 않는다.
//   snapshot [파일]    1기 공개 스냅샷(codyssey_Quest_Tracker 2026-08-12)으로 경험치 잔차와 가상 참여 모델 민감도를
//                      **집계로만** 출력한다(개인별 행·순위는 출력하지 않음). 파일이 없으면 공개 URL에서 받는다.
// 실행: node scripts/analyze-participation.mjs credit ~/private/credit.json
// 테스트: npm test (합성 자료만 사용)
import { readFileSync } from "fs";
import { pathToFileURL } from "url";

const SNAPSHOT_URL =
  "https://raw.githubusercontent.com/giyeop-cody/codyssey_Quest_Tracker/main/docs/data/current.json";
// DATA.md 5.4절 확정값(185018은 미확정이라 제외 — 스냅샷에 PASS가 있으면 잔차에 남는다)
export const MISSION_XP = {
  185004: 600, 185005: 600, 185006: 900, 185007: 300, 185008: 1200, 185009: 1200, 185010: 1200,
  185011: 1600, 185012: 600, 185013: 1200, 185014: 1200, 185015: 600, 185016: 600, 185017: 1800,
};
const REQUIRED = ["185004", "185005", "185006", "185007", "185008", "185009", "185010", "185012", "185015", "185016", "185017"];
const TRANSFER_XP = 1000; // 선발이관적립(type 212)
const SESSION_XP = 5; // type 24 평가종료
const BACKFILL_MIN_ROWS = 5; // 같은 초에 이 이상 찍히면 소급 일괄 적립으로 본다
const PASSES_TO_COMPLETE = 3; // 전달 규칙(DATA.md 12.3절): 서로 다른 평가자 3명의 PASS
// PASS와 같은 초에 찍히면 그 PASS의 부속으로 보는 크레딧
const ATTACHED = ["BNS_QSTN", "TERM_PRJ", "CRS_CMPL"];
const STANDALONE = ["PEER_FB", "SCHD_ATND", "OPS_GRNT", "EXAM_PASS", "FINAL_PRJ"];
// 본인 07-30 체크포인트(DATA.md 5.2·12.7절): exp 6,540에서 PASS 8건. 후보는 도구학습 13개 중 08-05에 PASS한 185011을 뺀 12개.
// 가정: 소급 PASS 6건이 모두 07-20 이전 사건, type 23(+2)은 그때까지 0~3건. 가정이 틀리면 이 결과도 무효다.
const CHECKPOINT_0730 = {
  restXp: 6540 - TRANSFER_XP,
  k: 8,
  candidates: ["185004", "185005", "185006", "185007", "185008", "185009", "185010", "185012", "185013", "185014", "185015", "185016"],
  maxCancel: 3,
};

// "2026-10-11 12:54:21"(KST 벽시계) → 같은 벽시계의 UTC ms. 시스템 타임존 비의존(collect-live.mjs와 같은 방식).
const ms = (s) => {
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  return m ? Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : NaN;
};
const day = (t) => new Date(t).toISOString().slice(0, 10);
const month = (t) => day(t).slice(0, 7);
// 월요일 시작 주 — 주의 월요일 날짜로 표기
const week = (t) => {
  const d = new Date(t);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return day(d.getTime());
};
const DAY_MS = 86_400_000;

// 미션 한 개의 세션 판정 열("P"/"F")을 운영 규칙(전달 규칙, 검증 안 됨)으로 읽는다.
//   consecutive: 2026-08경 이전. FAIL이 시도를 끝내고 PASS 수가 0으로 돌아간다 → 시도당 세션 ≤ 3.
//   cumulative:  그 이후. FAIL이 있어도 PASS가 쌓인다. FAIL이 차수(evlDegr)를 끝내는지는 미확인이라 attempts는 null.
// 반환: 완료된 세션 순번(1부터, 미완료면 null), 쓴 세션 수, 연속 규칙의 시도 수.
export function simulateMission(results, rule) {
  let passes = 0, attempts = 1;
  for (let i = 0; i < results.length; i++) {
    if (results[i] === "P") passes++;
    else if (rule === "consecutive") {
      passes = 0;
      if (i < results.length - 1) attempts++;
    }
    if (passes === PASSES_TO_COMPLETE)
      return { completedAt: i + 1, sessions: i + 1, attempts: rule === "consecutive" ? attempts : null };
  }
  return { completedAt: null, sessions: results.length, attempts: rule === "consecutive" ? attempts : null };
}

// 크레딧 행 → 학습자 사건. 같은 초의 행은 한 번의 발급이고, MSN_CMPL이 하나뿐인 초의 ATTACHED 크레딧은 그 미션 완료의 속성이다
// (미션 완료 1건 = MSN_CMPL + 부속 크레딧 — 따로 세면 이중 계산). 같은 초에 BACKFILL_MIN_ROWS행 이상이면 소급으로 표시한다.
export function groupCredits(rows) {
  const num = (r) => Number(r.creditScr);
  const earned = rows.filter((r) => num(r) > 0).reduce((s, r) => s + num(r), 0);
  const spent = rows.filter((r) => num(r) < 0).reduce((s, r) => s + num(r), 0);
  const bySecond = new Map();
  for (const r of rows) (bySecond.get(r.regDt) ?? bySecond.set(r.regDt, []).get(r.regDt)).push(r);
  const known = new Set(["MSN_CMPL", ...ATTACHED, ...STANDALONE]);
  const activities = []; // {t, kind, backfill, attrs}
  const backfills = [];
  for (const [regDt, group] of [...bySecond].sort()) {
    const t = ms(regDt);
    const backfill = group.length >= BACKFILL_MIN_ROWS;
    if (backfill) {
      const c = {};
      for (const r of group) c[r.triggerCd ?? "(없음)"] = (c[r.triggerCd ?? "(없음)"] ?? 0) + 1;
      backfills.push({ regDt, counts: c });
    }
    const of = (cd) => group.filter((r) => r.triggerCd === cd && num(r) > 0);
    const missions = of("MSN_CMPL");
    // 부속 크레딧은 같은 초의 미션 완료가 정확히 하나일 때만 귀속한다(소급 묶음이나 동시 완료에서는 귀속 불가 → 별도 사건)
    const attachable = !backfill && missions.length === 1;
    for (const r of missions) {
      const attrs = [`난이도${r.subKey ?? "?"}`];
      if (attachable) for (const cd of ATTACHED) if (of(cd).length) attrs.push(cd);
      activities.push({ t, kind: "미션 완료", backfill, attrs });
    }
    if (!attachable)
      for (const cd of ATTACHED) for (let i = 0; i < of(cd).length; i++) activities.push({ t, kind: cd, backfill, attrs: [] });
    for (const cd of STANDALONE) for (let i = 0; i < of(cd).length; i++) activities.push({ t, kind: cd, backfill, attrs: [] });
    for (const r of group.filter((r) => num(r) > 0 && !known.has(r.triggerCd)))
      activities.push({ t, kind: `기타(${r.triggerCd ?? "없음"})`, backfill, attrs: [] });
    for (const r of group.filter((r) => num(r) < 0)) activities.push({ t, kind: "상점 구매", backfill, attrs: [String(num(r))] });
  }
  return { earned, spent, activities, backfills };
}

// 받은 세션의 하한 — 전달 규칙(동료평가 미션 = PASS 세션 3, 기초 텀프로젝트 = 퍼실리테이터 평가 1)을 가정한 조건부 값.
// 텀은 같은 초에 TERM_PRJ가 붙은 미션 완료로만 알아본다(소급 묶음 안의 텀은 구분 못 함).
export function receivedSessionFloor(activities) {
  const done = activities.filter((a) => a.kind === "미션 완료");
  const term = done.filter((a) => a.attrs.includes("TERM_PRJ")).length;
  const perMission = simulateMission(Array(PASSES_TO_COMPLETE).fill("P"), "consecutive").sessions;
  return { missions: done.length, term, peer: done.length - term, floor: (done.length - term) * perMission + term };
}

// 경험치 체크포인트에서 완료 미션 조합과 받은 세션 수를 역산한다. candidateXp 중 k개를 고르는 조합의 XP 합마다
// 남는 경험치를 type 24(+5)와 type 23(+2, 최대 maxCancel건)으로 나누는 방법을 모두 돌려준다. 가정은 호출하는 쪽이 명시한다.
export function checkpointSessions(candidateXp, k, restXp, maxCancel = 0) {
  const sums = new Map();
  const n = candidateXp.length;
  for (let mask = 0; mask < 1 << n; mask++) {
    let c = 0, s = 0;
    for (let i = 0; i < n; i++) {
      if ((mask >> i) & 1) {
        c++;
        s += candidateXp[i];
      }
    }
    if (c === k && s <= restXp) sums.set(s, (sums.get(s) ?? 0) + 1);
  }
  const out = [];
  for (const [sum, combos] of [...sums].sort((a, b) => b[0] - a[0])) {
    const left = restXp - sum;
    for (let cancels = 0; cancels <= maxCancel; cancels++)
      if (left - 2 * cancels >= 0 && (left - 2 * cancels) % SESSION_XP === 0)
        out.push({ sum, combos, cancels, sessions: (left - 2 * cancels) / SESSION_XP });
  }
  return out;
}

function credit(path) {
  const { earned, spent, activities, backfills } = groupCredits(JSON.parse(readFileSync(path, "utf8")));
  console.log(`번 크레딧 ${earned} · 쓴 크레딧 ${spent} · 잔액 ${earned + spent} (잔액은 구매로 줄어 참여 지표가 아님)`);
  for (const b of backfills)
    console.log(`소급 일괄 적립 ${b.regDt}: ${JSON.stringify(b.counts)} — 실제 활동 시각 미상, 시계열에서 제외`);

  console.log("\n# 사건 타임라인(발급 시각 = 평가 시각, 풀이 시각 아님 · 소급 제외)");
  for (const a of activities.filter((a) => !a.backfill))
    console.log(new Date(a.t).toISOString().slice(0, 19).replace("T", " "), a.kind, a.attrs.join(" "));

  const live = activities.filter((a) => !a.backfill && a.kind !== "상점 구매");
  const kinds = [...new Set(live.map((a) => a.kind))];
  const table = (label, keyFn) => {
    const m = new Map();
    for (const a of live) {
      const k = keyFn(a.t);
      const e = m.get(k) ?? Object.fromEntries(kinds.map((x) => [x, 0]));
      e[a.kind]++;
      m.set(k, e);
    }
    console.log(`\n# ${label}(소급 제외, 활동이 있었던 구간만)`);
    console.log(["구간", ...kinds].join("\t"));
    for (const [k, e] of [...m].sort()) console.log([k, ...kinds.map((x) => e[x])].join("\t"));
  };
  table("일별", day);
  table("주별(월요일 시작)", week);
  table("월별", month);

  // 꾸준함: 첫 실시간 발급 주 ~ 마지막 발급 주 사이의 활동 주 비율과 최장 공백
  const ts = live.map((a) => a.t).sort((a, b) => a - b);
  const weeks = new Set(ts.map(week));
  const span = Math.round((ms(`${week(ts.at(-1))} 00:00:00`) - ms(`${week(ts[0])} 00:00:00`)) / (7 * DAY_MS)) + 1;
  let gap = 0, gapFrom = null;
  for (let i = 1; i < ts.length; i++) if (ts[i] - ts[i - 1] > gap) [gap, gapFrom] = [ts[i] - ts[i - 1], ts[i - 1]];
  console.log(`\n# 관측 범위·꾸준함(크레딧 발급 기준 — 실제 활동의 하한, 몰아서 평가 요청하면 공백이 길어 보임)`);
  console.log(`실시간 발급 범위 ${day(ts[0])} ~ ${day(ts.at(-1))} · 활동 주 ${weeks.size}/${span}`);
  console.log(`최장 공백 ${(gap / DAY_MS).toFixed(1)}일 (${day(gapFrom)} 이후)`);
  for (const k of kinds) {
    const w = new Set(live.filter((a) => a.kind === k).map((a) => week(a.t)));
    console.log(`  ${k}: ${live.filter((a) => a.kind === k).length}건, 활동 주 ${w.size}/${span}`);
  }
  console.log(`첫 실시간 발급 이전(과정 시작 ~ ${day(ts[0])})은 크레딧으로는 관측 불가 — 소급분만 존재`);

  const f = receivedSessionFloor(activities);
  console.log(`\n# 받은 세션 하한(DATA.md 12.7절) — 조건부: 동료평가 미션 3 PASS·기초 텀 1회 평가(전달 규칙)를 가정`);
  console.log(`미션 완료 ${f.missions} = 동료평가 ${f.peer} + 텀 ${f.term} → 하한 ${f.floor}. 화면 "평가 완료"·type 24 건수와 비교한다`);
  console.log("PEER_FB는 평가자 쪽 보상으로 보이지만 세션마다 붙는지는 미확인 — 화면 평가 참여 수와 다를 수 있다");

  const c = CHECKPOINT_0730;
  const fits = checkpointSessions(c.candidates.map((q) => MISSION_XP[q]), c.k, c.restXp, c.maxCancel);
  console.log(`\n# 07-30 체크포인트(조건부 — 가정은 스크립트 상수 주석): PASS ${c.k}건으로 exp ${c.restXp + TRANSFER_XP}를 설명하는 방법`);
  for (const x of fits) console.log(`  미션 XP 합 ${x.sum}(조합 ${x.combos}개) + 취소 ${x.cancels}건 → 받은 세션 ${x.sessions} (최소 ${c.k * 3})`);
}

// 평균 순위(동점 처리) → 스피어만 상관
function ranks(xs) {
  const idx = xs.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
  const r = Array(xs.length);
  for (let i = 0; i < idx.length; ) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return r;
}
function pearson(a, b) {
  const n = a.length, ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n;
  let c = 0, va = 0, vb = 0;
  for (let i = 0; i < n; i++) {
    c += (a[i] - ma) * (b[i] - mb);
    va += (a[i] - ma) ** 2;
    vb += (b[i] - mb) ** 2;
  }
  return c / Math.sqrt(va * vb);
}
const spearman = (a, b) => pearson(ranks(a), ranks(b));
const z = (xs) => {
  const m = xs.reduce((s, x) => s + x, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length) || 1;
  return xs.map((x) => (x - m) / sd);
};
// 상위 k명 집합(동점이면 경계에 걸린 사람 모두 포함 — 동점 때문에 k보다 커질 수 있다)
function top(scores, k) {
  const cut = [...scores].sort((a, b) => b - a)[k - 1];
  return new Set(scores.map((s, i) => [s, i]).filter(([s]) => s >= cut).map(([, i]) => i));
}

// 스냅샷 회원 한 명 → 분석용 값. 잔차 = exp − 선발이관 − Σ PASS 과제 XP(받은 세션 × 5 + 취소 × 2로 해석, DATA.md 12.10절).
// attempts는 과제별 최신 행의 evlDegr 합이라 하한. 포인트(pnt)는 평가 경제 화폐라 잔차·완료와 섞지 않는다.
export function memberStats(m) {
  let xp = 0, pass = 0, req = 0, attempts = 0, retries = 0, open = false;
  for (const [q, s] of Object.entries(m.progress ?? {})) {
    const deg = Number(s.evlDegr) || 1;
    if (s.st === "C") attempts += deg;
    if (s.st === "E") open = true;
    retries += deg - 1;
    if (s.st === "C" && s.resultNm === "PASS") {
      pass++;
      xp += MISSION_XP[q] ?? 0;
      if (REQUIRED.includes(q)) req++;
    }
  }
  return { residual: m.exp - TRANSFER_XP - xp, xp, pass, req, attempts, retries, open, pnt: m.pnt };
}

async function snapshot(path) {
  const d = path
    ? JSON.parse(readFileSync(path, "utf8"))
    : await (await fetch(SNAPSHOT_URL, { signal: AbortSignal.timeout(20000) })).json();
  // 개인별 값은 이 배열 안에서만 쓰고 밖으로 내보내지 않는다(집계만 출력)
  const M = d.members.map(memberStats);
  const R = M.map((m) => m.residual).sort((a, b) => a - b);
  const q = (p) => R[Math.floor(p * (R.length - 1))];
  const sum = M.reduce((s, m) => s + m.residual, 0);
  const attempts = M.reduce((s, m) => s + m.attempts, 0);
  console.log(`${d.meta.generatedAt} · ${M.length}명`);
  console.log("전제: 연속 PASS 규칙 시기(2026-08경 이전, 변경일 미검증)의 자료로 본다. 누적 규칙 이후 자료에는 시도당 세션 ≤ 3 해석·재평가 수를 그대로 쓰지 않는다");
  console.log(`# 경험치 잔차 = exp − ${TRANSFER_XP} − Σ PASS 과제 XP`);
  console.log(`음수 ${R.filter((x) => x < 0).length} · 5의 배수 아님 ${R.filter((x) => x % 5).length} · 0 ${R.filter((x) => x === 0).length}`);
  console.log(`최소 ${R[0]} · 25% ${q(0.25)} · 중앙 ${q(0.5)} · 75% ${q(0.75)} · 90% ${q(0.9)} · 최대 ${R.at(-1)}`);
  console.log(`+5 사건 합 ${sum / SESSION_XP} · 완료 평가 시도(최신 행 evlDegr 합, 하한) ${attempts} · 평균 ${(sum / SESSION_XP / attempts).toFixed(2)}`);

  // 개인별 시도당 +5 — 받는 쪽 세션마다 적립이면 연속 규칙의 상한 3에서 멈춰야 한다(열린 평가가 있으면 넘을 수 있음)
  const bins = { "시도 0": 0, "3 미만": 0, "정확히 3": 0, "3 초과·열린 평가 있음": 0, "3 초과·열린 평가 없음": 0 };
  for (const m of M) {
    const r = m.attempts ? m.residual / SESSION_XP / m.attempts : null;
    if (r === null) bins["시도 0"]++;
    else if (r < 3) bins["3 미만"]++;
    else if (r === 3) bins["정확히 3"]++;
    else bins[m.open ? "3 초과·열린 평가 있음" : "3 초과·열린 평가 없음"]++;
  }
  console.log("시도당 +5:", Object.entries(bins).map(([k, v]) => `${k} ${v}`).join(" · "));

  // 가상 참여 모델 — 민감도 비교용. 공식 산식이 아니다.
  const dims = {
    "필수 완료율": M.map((m) => m.req / REQUIRED.length),
    "PASS 과제 XP": M.map((m) => m.xp),
    "받은 평가(잔차)": M.map((m) => m.residual),
  };
  const names = Object.keys(dims);
  const zs = names.map((n) => z(dims[n]));
  const rs = names.map((n) => ranks(dims[n]));
  const models = {
    "완료 중심": dims["필수 완료율"],
    "받은 평가 중심": dims["받은 평가(잔차)"],
    "동일 가중 z": M.map((_, i) => zs.reduce((s, zz) => s + zz[i], 0)),
    "순위 합": M.map((_, i) => rs.reduce((s, r) => s + r[i], 0)),
    "받은 평가 제외 z": M.map((_, i) => zs[0][i] + zs[1][i]),
  };
  console.log("\n# 차원 간 스피어만 상관");
  for (let i = 0; i < names.length; i++)
    for (let j = i + 1; j < names.length; j++)
      console.log(`  ${names[i]} × ${names[j]}: ${spearman(dims[names[i]], dims[names[j]]).toFixed(2)}`);
  console.log(`  재평가 수 × 받은 평가: ${spearman(M.map((m) => m.retries), dims["받은 평가(잔차)"]).toFixed(2)}`);
  console.log(`  포인트(pnt) × 받은 평가: ${spearman(M.map((m) => m.pnt), dims["받은 평가(잔차)"]).toFixed(2)}`);
  console.log(`동점: 필수 완료율 고유값 ${new Set(dims["필수 완료율"]).size}개, 잔차 0인 사람 ${R.filter((x) => x === 0).length}명`);
  console.log("한 평가(평가자 쪽)는 이 스냅샷에 없어 어떤 모델에도 들어가지 않는다");

  const k = Math.round(M.length * 0.1);
  const mn = Object.keys(models);
  console.log(`\n# 모델 간 상위 10%(${k}명) 겹침 — 행: 기준 모델, 값: 겹친 인원/기준 집합 크기(동점 포함)`);
  const tops = mn.map((n) => top(models[n], k));
  console.log(["", ...mn].join("\t"));
  for (let i = 0; i < mn.length; i++)
    console.log([`${mn[i]}(${tops[i].size})`, ...mn.map((_, j) => [...tops[i]].filter((x) => tops[j].has(x)).length)].join("\t"));
  console.log("\n# 모델 간 스피어만 상관");
  for (let i = 0; i < mn.length; i++)
    console.log([mn[i], ...mn.map((n) => spearman(models[mn[i]], models[n]).toFixed(2))].join("\t"));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === "credit" && arg) credit(arg);
  else if (cmd === "snapshot") await snapshot(arg);
  else {
    console.error("사용법: node scripts/analyze-participation.mjs credit <본인 크레딧 JSON> | snapshot [스냅샷 JSON]");
    process.exit(1);
  }
}
