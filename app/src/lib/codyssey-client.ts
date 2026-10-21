// 읽기 전용 실시간 개인 데이터 연동. 본인 세션(CODYSSEY_SESSION, 서버 전용 env 또는 방문자 쿠키)으로
// 본인 데이터만 매 요청마다 직접 조회한다 — 로그인 UI는 구현하지 않는다(브라우저에서 로그인 후 세션
// 쿠키를 복사해 붙여넣는 방식은 그대로 유지, docs/data-source-map.md 3단계 참고).
// 쓰기 API 호출 없음.
//
// 필드 출처(실사용자 세션으로 검증, 2026-07-30):
// - rest/user/info/detail.result.mbrNm → 닉네임
// - point/pnt/total/detail.result: level/exp/pnt/nextLvlRequiredExprc — 전부 실화면(대시보드 LEVEL/POINT
//   배지)과 일치 확인됨. rest/user/info/detail.result.instList[0].level은 같은 화면의 레벨 배지와 값이
//   달랐다(실제 Lv.4 계정에 level: "32") — 다른 의미의 카운터로 추정되며 사용하지 않는다.
// - learning/learningProgress/status/list.result.uqstns[]: uqstnResultYn이 "PASS"면 완료, "평가전"이면
//   제출 후 평가 대기(진행중으로 취급), null이면 미시작.
import { createHash } from "crypto";
import type { Member } from "@/domain/member";
import type { Confidence } from "@/domain/quest";

const API_BASE = "https://api.usr.codyssey.kr/";

export interface RealMemberSnapshot {
  fetchedAt: string;
  profile: unknown;
  pointTotal: unknown;
  questStatus: unknown;
}

async function fetchJson(path: string, method: "GET" | "POST", session: string): Promise<unknown> {
  const res = await fetch(API_BASE + path, {
    method,
    headers: { Cookie: session },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${path} 실패: HTTP ${res.status}`);
  return res.json();
}

// sessionOverride: 방문자가 직접 붙여넣은 JSESSIONID(쿠키, 브라우저에만 저장). 배포본은 여러 방문자가
// 같은 서버 환경변수를 공유하므로, 서버 env(CODYSSEY_SESSION)를 기본값으로 깔되 방문자 세션이 있으면
// 그것을 우선한다 — 그래야 공개 배포에서 한 사람의 계정 데이터가 모두에게 노출되지 않는다.
// 세션 미설정 시 null — 호출부는 데모 페르소나로 폴백한다.
// 세션이 설정됐지만 만료/오류인 경우도 null — 화면이 깨지는 대신 데모로 폴백하고 배너로 알린다.
export async function fetchRealMember(sessionOverride?: string | null): Promise<RealMemberSnapshot | null> {
  const session = sessionOverride || process.env.CODYSSEY_SESSION;
  if (!session) return null;

  try {
    const [profile, pointTotal, questStatus] = await Promise.all([
      fetchJson("rest/user/info/detail", "GET", session),
      fetchJson("point/pnt/total/detail", "GET", session),
      fetchJson("learning/learningProgress/status/list", "GET", session),
    ]);
    return { fetchedAt: new Date().toISOString(), profile, pointTotal, questStatus };
  } catch (e) {
    console.error("실제 계정 연동 실패, 데모 페르소나로 폴백:", (e as Error).message);
    return null;
  }
}

// Member 타입에 매핑 가능한 필드만 뽑는다. 완료/진행중 과제 목록은 questStatus에서 온 uqstnNo를
// "q" + uqstnNo 형식(quests 테이블 id 규칙)으로 변환한다.
export function mapRealMember(
  snapshot: RealMemberSnapshot
):
  | (Pick<
      Member,
      | "displayName"
      | "level"
      | "exp"
      | "points"
      | "completedQuestIds"
      | "inProgressQuestIds"
      | "level5ExamEligible"
      | "level5ExamConfidence"
    > & { nextLevelExp: number })
  | null {
  const profileResult = (snapshot.profile as { result?: { mbrNm?: unknown } } | null)?.result;
  const pnt = (snapshot.pointTotal as { result?: Record<string, unknown> } | null)?.result;
  if (!profileResult || !pnt) return null;

  const level = Number(pnt.level);
  const exp = Number(pnt.exp);
  const points = Number(pnt.pnt);
  const nextLevelExp = Number(pnt.nextLvlRequiredExprc);
  if ([level, exp, points, nextLevelExp].some(Number.isNaN)) return null;

  const uqstns = (snapshot.questStatus as { result?: { uqstns?: unknown } } | null)?.result?.uqstns;
  const completedQuestIds: string[] = [];
  const inProgressQuestIds: string[] = [];
  if (Array.isArray(uqstns)) {
    for (const u of uqstns as { uqstnNo?: unknown; uqstnResultYn?: unknown }[]) {
      if (u.uqstnNo === undefined) continue;
      const id = `q${u.uqstnNo}`;
      if (u.uqstnResultYn === "PASS") completedQuestIds.push(id);
      else if (u.uqstnResultYn === "평가전") inProgressQuestIds.push(id);
    }
  }

  // 5레벨 시험 응시 조건 자체(경험치 임계값만으로 충분한지, 별도 심사가 있는지)는 공식 확인되지 않았다 —
  // 그래서 이 판정은 observed(실제 API 필드 기반이지만 규칙 자체는 미검증)로 표시한다.
  const level5ExamEligible = level >= 5 || exp >= nextLevelExp;
  const level5ExamConfidence: Confidence = "observed";

  return {
    displayName: typeof profileResult.mbrNm === "string" ? profileResult.mbrNm : "본인 계정",
    level,
    exp,
    points,
    nextLevelExp,
    completedQuestIds,
    inProgressQuestIds,
    level5ExamEligible,
    level5ExamConfidence,
  };
}

export type Course = "올인원" | "네이티브" | "기타";
export type Cohort = "1기" | "2기" | null; // null: 1기 명단을 받지 못해 판정 불가

export interface LevelDistributionEntry {
  course: Course;
  cohort: Cohort;
  level: number;
  count: number;
}

// 과정은 세션 계정의 instList[0].instNm으로 판정한다 — 길드 API는 세션 기관(instCd) 소속 길드만 돌려주고
// instCd 파라미터는 무시한다(2026-10-21 확인). 그래서 한 세션으로는 한 과정만 집계되고, 다른 과정 분포는
// 그 과정 계정의 세션이 있어야 한다.
function courseOf(instNm: unknown): Course {
  const s = String(instNm ?? "");
  if (s.includes("올인원")) return "올인원";
  if (s.includes("네이티브")) return "네이티브";
  return "기타";
}

// 기수 API가 없어(길드 members[].classNm 전원 null) 외부 스냅샷으로 가른다: 1기 = 아카이브된
// codyssey_Quest_Tracker의 마지막 명단(2026-08-12, 150명 — 당시 길드 총원 = 1기 전원)에 있는 사람.
// 2026-10-21 검증: 명단 밖 215명은 8/13 이전 평가 기록이 0건(첫 평가 2026-09~), 명단 안 142명 중 113명은
// 8/13 이전 기록 있음. mbrId 대역 구분은 2기 지원자의 선행 가입 계정이 1기 대역에 섞여 틀렸다(29명).
// 명단은 저장소에 복사하지 않고 매번 공개 URL에서 받아 메모리에서만 대조한다. 1기는 새로 늘지 않으니
// 프로세스당 한 번만 받는다. 받지 못하면 null — 기수 구분 없이 합계만 보인다.
const COHORT1_ROSTER_URL =
  "https://raw.githubusercontent.com/giyeop-cody/codyssey_Quest_Tracker/main/docs/data/current.json";
let cohort1Roster: Promise<Set<string> | null> | null = null;
function loadCohort1Roster(): Promise<Set<string> | null> {
  cohort1Roster ??= fetch(COHORT1_ROSTER_URL, { cache: "no-store", signal: AbortSignal.timeout(15000) })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((d: { members?: { mbrId?: unknown }[] }) => new Set((d.members ?? []).map((m) => String(m.mbrId))))
    .catch((e) => {
      console.error("1기 명단 조회 실패, 기수 구분 생략:", (e as Error).message);
      cohort1Roster = null; // 다음 요청에서 다시 시도
      return null;
    });
  return cohort1Roster;
}
const rosterKey = (mbrId: unknown) => "sha1:" + createHash("sha1").update(String(mbrId)).digest("hex").slice(0, 8);

// 길드 랭킹 상세 화면에서 실사용자가 직접 확인하던 레벨 분포를, 같은 화면이 쓰는 API로 대체한다.
// 시즌의 전체 길드를 순회해 members[].level(+기수 판정용 mbrId)만 집계하고 즉시 버린다 — 실명/이메일 등 개인정보는
// 이 함수 밖으로 절대 나가지 않는다(docs/privacy-threat-model.md). 세션이 없거나 실패하면 null —
// 호출부는 기존 관측 스냅샷(OBSERVED_LEVEL_DISTRIBUTION)으로 폴백한다.
export async function fetchRealLevelDistribution(
  sessionOverride?: string | null
): Promise<LevelDistributionEntry[] | null> {
  const session = sessionOverride || process.env.CODYSSEY_SESSION;
  if (!session) return null;

  try {
    const profile = (await fetchJson("rest/user/info/detail", "GET", session)) as {
      result?: { instList?: { instNm?: unknown }[] };
    };
    const course = courseOf(profile.result?.instList?.[0]?.instNm);
    const season = (
      (await fetchJson("guild/season/currentSeasonDetail", "GET", session)) as {
        result: { guildSeasonId: number; currentWeekNo: number };
      }
    ).result;

    const weekly = (
      (await fetchJson(
        `guild/ranking/weeklyList?guildSeasonId=${season.guildSeasonId}&weekNo=${season.currentWeekNo}`,
        "GET",
        session
      )) as { result: { rankings: { guildId: number }[] } }
    ).result;
    const guildIds = weekly.rankings.map((r) => r.guildId);

    const roster = await loadCohort1Roster();
    const counts = new Map<string, LevelDistributionEntry>();
    for (const guildId of guildIds) {
      const detail = (
        (await fetchJson(
          `guild/${guildId}/detail?guildSeasonId=${season.guildSeasonId}&weekNo=${season.currentWeekNo}`,
          "GET",
          session
        )) as { result: { members: { mbrId?: unknown; level?: unknown }[] } }
      ).result;
      for (const m of detail.members) {
        const level = Number(m.level);
        if (Number.isNaN(level)) continue;
        const cohort: Cohort = roster ? (roster.has(rosterKey(m.mbrId)) ? "1기" : "2기") : null;
        const key = `${cohort}|${level}`;
        const e = counts.get(key) ?? { course, cohort, level, count: 0 };
        e.count++;
        counts.set(key, e);
      }
    }

    return [...counts.values()].sort((a, b) => a.level - b.level || String(a.cohort).localeCompare(String(b.cohort)));
  } catch (e) {
    console.error("실제 레벨 분포 조회 실패, 관측 스냅샷으로 폴백:", (e as Error).message);
    return null;
  }
}
