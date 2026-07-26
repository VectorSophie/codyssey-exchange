#!/usr/bin/env node
// 읽기 전용 개인 데이터 수집기. 본인 세션(CODYSSEY_SESSION, .env)으로 본인 데이터만 가져온다.
// 로그인 UI를 이 앱에 구현하지 않는 이유: 참조 트래커들과 동일하게, 사용자가 직접
// 로그인 후 브라우저에서 세션 쿠키를 복사해 .env에 붙여넣는 방식을 그대로 따른다.
// 쓰기 API 호출 없음. 실패 시 이전 data/private/me.json을 덮어쓰지 않는다.
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = `${__dirname}/../data/private/me.json`;
const API_BASE = "https://api.usr.codyssey.kr/";

function loadEnv() {
  const envPath = `${__dirname}/../.env`;
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

async function fetchJson(path, method = "GET") {
  const res = await fetch(API_BASE + path, {
    method,
    headers: { Cookie: process.env.CODYSSEY_SESSION ?? "" },
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error(`세션 만료(${res.status}) — .env의 CODYSSEY_SESSION을 새로 갱신하세요`);
  }
  if (!res.ok) throw new Error(`${path} 실패: HTTP ${res.status}`);
  return res.json();
}

async function main() {
  loadEnv();
  if (!process.env.CODYSSEY_SESSION) {
    console.error("CODYSSEY_SESSION이 .env에 없습니다. 로그인 후 JSESSIONID 쿠키를 복사해 넣어주세요.");
    process.exit(1);
  }

  const collectedAt = new Date().toISOString();
  const result = { collectedAt, source: "usr.codyssey.kr (본인 세션, 읽기 전용)" };

  try {
    result.profile = await fetchJson("rest/user/info/detail");
  } catch (e) {
    console.error("프로필 수집 실패:", e.message);
    process.exit(1);
  }

  try {
    result.examList = await fetchJson("exam/usr/list", "POST");
  } catch (e) {
    console.warn("시험 접수 목록 수집 실패(계속 진행):", e.message);
    result.examList = null;
  }

  try {
    result.examResults = await fetchJson("exam/usr/result/list", "POST");
  } catch (e) {
    console.warn("시험 결과 수집 실패(계속 진행):", e.message);
    result.examResults = null;
  }

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(result, null, 2));
  console.log(`저장 완료: ${OUT_PATH}`);
}

main();
