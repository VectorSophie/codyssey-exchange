import postgres from "postgres";

// 앱 프로세스당 커넥션 풀 하나. Next.js dev의 모듈 재적재로 중복 생성되는 것만 globalThis로 방지한다.
declare global {
  var __codysseySql: ReturnType<typeof postgres> | undefined;
}

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL이 설정되지 않았습니다 — .env 또는 배포 환경 변수를 확인하세요.");
  }
  return postgres(url, { max: 5 });
}

export const sql = globalThis.__codysseySql ?? createClient();
if (process.env.NODE_ENV !== "production") {
  globalThis.__codysseySql = sql;
}
