// 읽기 전용 실시간 개인 데이터 연동. 본인 세션(CODYSSEY_SESSION, 서버 전용 env)으로 본인 데이터만
// 매 요청마다 직접 조회한다 — 로그인 UI는 구현하지 않는다(브라우저에서 로그인 후 세션 쿠키를 복사해
// .env/배포 시크릿에 붙여넣는 방식은 그대로 유지, docs/data-source-map.md 3단계 참고).
// 쓰기 API 호출 없음. 응답 필드 구조는 아직 공식 확인되지 않았으므로(README 알려진 한계) Member 타입으로
// 추측 매핑하지 않고 원본을 노출한다 — 필드를 확인하면 domain/member.ts 매핑을 채워 넣는다.
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
