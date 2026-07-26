import { existsSync, readFileSync } from "fs";
import path from "path";

// scripts/collect-me.mjs가 쓰는 개인 데이터 파일. 존재하면 실제 연동이 되어있다는 뜻이지만,
// 응답 필드 구조를 아직 검증/매핑하지 않았으므로(어댑터 미구현) 원본 그대로만 노출한다.
// 추측으로 Member 도메인 타입에 끼워 맞추지 않는다 — 매핑은 필드 확인 후 별도 작업.
export function readRealMeFile(): { collectedAt: string; raw: unknown } | null {
  const filePath = path.join(process.cwd(), "..", "data", "private", "me.json");
  if (!existsSync(filePath)) return null;
  try {
    const data = JSON.parse(readFileSync(filePath, "utf8"));
    return { collectedAt: data.collectedAt, raw: data };
  } catch {
    return null;
  }
}
