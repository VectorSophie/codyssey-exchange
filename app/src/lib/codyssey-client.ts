// 읽기 전용 실시간 개인 데이터 연동. 본인 세션(CODYSSEY_SESSION, 서버 전용 env)으로 본인 데이터만
// 매 요청마다 직접 조회한다 — 로그인 UI는 구현하지 않는다(브라우저에서 로그인 후 세션 쿠키를 복사해
// .env/배포 시크릿에 붙여넣는 방식은 그대로 유지, docs/data-source-map.md 3단계 참고).
// 쓰기 API 호출 없음. rest/user/info/detail 응답 필드는 실제 세션으로 확인됨(Confirmed by API) —
// mapProfileToMember가 경험치/닉네임만 매핑한다. instList[0].level은 실사용자로 검증한 결과 화면의
// "레벨" 배지와 다른 값이었다(실제 Lv.4인데 level 필드는 32) — 다른 의미의 카운터로 추정되며 무엇인지
// 아직 확인되지 않아 매핑하지 않는다. 완료·진행중 과제 목록, 포인트, 시험 자격도 아직 매핑할 확인된
// 필드가 없어 데모 페르소나로 남는다.
import type { Member } from "@/domain/member";

const API_BASE = "https://api.usr.codyssey.kr/";

export interface RealMemberSnapshot {
  fetchedAt: string;
  profile: unknown;
  examList: unknown;
  examResults: unknown;
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
    const [profile, examList, examResults] = await Promise.all([
      fetchJson("rest/user/info/detail", "GET", session),
      fetchJson("exam/usr/list", "POST", session).catch(() => null),
      fetchJson("exam/usr/result/list", "POST", session).catch(() => null),
    ]);
    return { fetchedAt: new Date().toISOString(), profile, examList, examResults };
  } catch (e) {
    console.error("실제 계정 연동 실패, 데모 페르소나로 폴백:", (e as Error).message);
    return null;
  }
}

// rest/user/info/detail의 result.instList[0].exp에서 경험치를, result.mbrNm에서 닉네임을 가져온다.
// instList[0].level은 의도적으로 매핑하지 않는다 — 실사용자 검증 결과 화면 레벨 배지와 일치하지 않았다
// (Lv.4 실사용자에게 level: "32"가 옴). 레벨은 여전히 데모 페르소나 값으로 남는다.
// 응답 구조가 예상과 다르면(다른 기관 소속 등) null을 반환 — 호출부는 데모 페르소나 필드로 폴백한다.
export function mapProfileToMember(profile: unknown): Pick<Member, "displayName" | "exp"> | null {
  const result = (profile as { result?: unknown } | null)?.result as
    | { mbrNm?: unknown; instList?: unknown }
    | undefined;
  if (!result) return null;

  const inst = Array.isArray(result.instList) ? (result.instList[0] as { exp?: unknown }) : null;
  if (!inst) return null;

  const exp = Number(inst.exp);
  if (Number.isNaN(exp)) return null;

  return {
    displayName: typeof result.mbrNm === "string" ? result.mbrNm : "본인 계정",
    exp,
  };
}
