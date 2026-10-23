// analyze-participation.mjs 회귀 테스트 — 합성 자료만 쓴다(실제 원장·세션·DB 불필요). 실행: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  simulateMission,
  groupCredits,
  receivedSessionFloor,
  checkpointSessions,
  memberStats,
} from "./analyze-participation.mjs";

const row = (regDt, triggerCd, creditScr = 1, subKey = null) => ({ regDt, triggerCd, creditScr: String(creditScr), subKey });

test("3 PASS면 두 규칙 모두 세 번째 세션에서 완료", () => {
  for (const rule of ["consecutive", "cumulative"])
    assert.deepEqual(simulateMission(["P", "P", "P"], rule).completedAt, 3);
});

test("연속 규칙은 FAIL에서 PASS 수가 초기화되고, 누적 규칙은 이어진다", () => {
  const seq = ["P", "F", "P", "P"];
  assert.equal(simulateMission(seq, "consecutive").completedAt, null);
  assert.equal(simulateMission(seq, "cumulative").completedAt, 4);
  const more = simulateMission([...seq, "P"], "consecutive");
  assert.equal(more.completedAt, 5);
  assert.equal(more.attempts, 2);
  assert.equal(simulateMission(seq, "cumulative").attempts, null); // 누적 규칙의 차수 의미는 미확인
});

test("연속 규칙에서 한 시도의 세션은 3을 넘지 않는다", () => {
  const r = simulateMission(["P", "P", "F", "P", "P", "P"], "consecutive");
  assert.equal(r.attempts, 2);
  assert.equal(r.sessions, 6); // 시도 1: 3세션(FAIL로 끝), 시도 2: 3세션
});

test("같은 초 5행 이상은 소급으로 표시하고 부속 크레딧을 귀속하지 않는다", () => {
  const t = "2026-08-05 10:50:29";
  const g = groupCredits([row(t, "PEER_FB"), row(t, "PEER_FB"), row(t, "PEER_FB"), row(t, "MSN_CMPL", 2, 2), row(t, "BNS_QSTN")]);
  assert.equal(g.backfills.length, 1);
  assert.ok(g.activities.every((a) => a.backfill));
  assert.ok(g.activities.some((a) => a.kind === "BNS_QSTN"));
  const four = groupCredits([row(t, "PEER_FB"), row(t, "PEER_FB"), row(t, "PEER_FB"), row(t, "PEER_FB")]);
  assert.equal(four.backfills.length, 0);
});

test("미션 완료와 같은 초의 부속 크레딧은 한 사건이다(이중 계산 없음)", () => {
  const t = "2026-09-20 01:21:05";
  const g = groupCredits([row(t, "MSN_CMPL", 2, 2), row(t, "TERM_PRJ", 5), row(t, "CRS_CMPL", 5), row(t, "BNS_QSTN")]);
  assert.equal(g.activities.length, 1);
  assert.deepEqual(g.activities[0].attrs, ["난이도2", "BNS_QSTN", "TERM_PRJ", "CRS_CMPL"]);
  assert.equal(g.earned, 13); // 크레딧 합은 그대로 — 묶는 것은 사건 수뿐
});

test("같은 초에 미션 완료가 둘이면 보너스를 어느 쪽에도 귀속하지 않는다", () => {
  const t = "2026-07-26 16:24:43";
  const g = groupCredits([row(t, "MSN_CMPL", 1, 1), row(t, "MSN_CMPL", 1, 1), row(t, "BNS_QSTN")]);
  assert.equal(g.activities.filter((a) => a.kind === "미션 완료").length, 2);
  assert.ok(g.activities.every((a) => !a.attrs.includes("BNS_QSTN")));
  assert.equal(g.activities.filter((a) => a.kind === "BNS_QSTN").length, 1);
});

test("구매는 음수로 따로 잡히고, 모르는 코드는 버리지 않는다", () => {
  const g = groupCredits([
    row("2026-09-09 10:00:00", null, -40),
    row("2026-09-08 10:00:00", "OPS_GRNT", 3),
    row("2026-10-01 10:00:00", "NEW_CODE", 2),
  ]);
  assert.equal(g.earned, 5);
  assert.equal(g.spent, -40);
  assert.ok(g.activities.some((a) => a.kind === "상점 구매"));
  assert.ok(g.activities.some((a) => a.kind === "기타(NEW_CODE)"));
});

test("받은 세션 하한: 동료평가 미션 × 3 + 텀 × 1 (조건부)", () => {
  const g = groupCredits([
    row("2026-07-26 16:24:43", "MSN_CMPL", 1, 1),
    row("2026-08-03 22:33:29", "MSN_CMPL", 2, 2),
    row("2026-09-20 01:21:05", "MSN_CMPL", 2, 2),
    row("2026-09-20 01:21:05", "TERM_PRJ", 5),
  ]);
  assert.deepEqual(receivedSessionFloor(g.activities), { missions: 3, term: 1, peer: 2, floor: 7 });
});

test("PEER_FB는 미션 완료와 따로 센다(평가자 쪽 사건)", () => {
  const t = "2026-08-08 21:53:37";
  const g = groupCredits([row(t, "PEER_FB"), row(t, "MSN_CMPL", 1, 1)]);
  assert.deepEqual(g.activities.map((a) => a.kind).sort(), ["PEER_FB", "미션 완료"].sort());
  assert.equal(receivedSessionFloor(g.activities).floor, 3);
});

test("체크포인트 역산은 가능한 모든 분해를 돌려준다", () => {
  // 후보 [100, 200, 300] 중 2개, 남은 XP 330: 합 300(조합 2개: 100+200, 300 단독은 1개라 제외) → 30 = 6세션 또는 +2×...
  const r = checkpointSessions([100, 200, 300], 2, 330, 3);
  assert.deepEqual(r, [{ sum: 300, combos: 1, cancels: 0, sessions: 6 }]);
  assert.deepEqual(checkpointSessions([100, 200], 2, 312, 1), [{ sum: 300, combos: 1, cancels: 1, sessions: 2 }]);
});

test("스냅샷 잔차는 포인트와 섞지 않고, 기록이 없는 회원도 처리한다", () => {
  const m = memberStats({
    exp: 1000 + 600 + 15,
    pnt: 1100,
    progress: { 185004: { st: "C", resultNm: "PASS", evlDegr: "1" }, 185005: { st: "E", resultNm: null, evlDegr: "2" } },
  });
  assert.equal(m.residual, 15);
  assert.equal(m.attempts, 1);
  assert.equal(m.retries, 1);
  assert.equal(m.open, true);
  assert.equal(m.pnt, 1100);
  const empty = memberStats({ exp: 1000, pnt: 1100 });
  assert.deepEqual([empty.residual, empty.attempts, empty.pass], [0, 0, 0]);
});
