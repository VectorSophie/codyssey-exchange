# Codyssey Exchange

코디세이 학습 활동(과제 진행, 평가 요청, 출입 기록, 레벨/시험)을 수요-공급-병목-진척이라는 경제 시장의 정보 문법으로 설명하는 학습 분석 도구다.
실제 화폐, 투자수익률, 매수/매도는 다루지 않는다 — 빌리는 것은 정보 구조뿐이다.

## 현재 상태

**과제 카탈로그(13개, AI/SW 기초), 상태 분포, PASS/FAIL, 최근 변화, 평가 시장 히트맵은 전부 실제 공개 데이터로 동작한다.**

- 시장 개요 / 과제 시세 / 과제 상세: `codyssey_Quest_Tracker` 공개 저장소 실제 스냅샷(상태 분포·PASS/FAIL·공식 학습시간) + `codyssey_EV_Tracker` 공개 저장소 실제 이벤트(트랙별 평균 처리시간) 조인
- 평가 시장: `codyssey_EV_Tracker` 3개월치(1,105건) 실제 이벤트를 시간대×요일로 집계(PII 제거)
- 내 전략 / 레벨과 시험: 과제 카탈로그는 실제 데이터, 진행 상태(완료/진행중 등)는 **데모 페르소나** — 본인의 실제 진행 상태를 쓰려면 아래 개인 데이터 수집을 실행한다

- [docs/product-vision.md](docs/product-vision.md) — 문제 정의, 경제 은유 매핑, 핵심 질문
- [docs/research/existing-trackers.md](docs/research/existing-trackers.md) — 기존 5개 트래커 저장소 조사
- [docs/research/interface-references.md](docs/research/interface-references.md) — 한국 증권시장 UI 레퍼런스 조사
- [docs/data-source-map.md](docs/data-source-map.md) — 데이터 수집 3단계 전략과 API 신뢰도
- [docs/privacy-threat-model.md](docs/privacy-threat-model.md) — 개인정보 경계
- [docs/metric-catalog.md](docs/metric-catalog.md) — 지표 정의 초안

## 실행

```bash
docker compose up -d db          # 로컬 Postgres (최초 1회)
cd app
npm install
cp .env.example .env.local       # DATABASE_URL 채우기 (docker-compose 기본값 그대로면 됨)
npm run db:seed                  # db/seed/*.json(실제 데이터 스냅샷) 적재
npm run dev                      # http://localhost:3000
npm run build
npm run start
```

개인 데이터 실시간 연동(선택 — `/me`, `/level-exam`을 실제 본인 진행 상태로 채우려면): `.env.local`에
`CODYSSEY_SESSION`을 채워 넣는다(브라우저 로그인 후 JSESSIONID 쿠키 복사, 아래 알려진 한계 참고). 비워두면
데모 페르소나로 자동 폴백한다. 별도 수집 스크립트는 없다 — 서버가 매 요청마다 직접 조회한다.

배포 시 DB는 관리형 Postgres(Neon/Supabase 등 무료 티어)를 권장한다 — "GitHub 러너 안의 DB"나 로컬
docker는 개발/CI 검증용이지 배포 서버가 상시 붙잡고 있을 대상이 아니다. `.github/workflows/db-check.yml`은
매 푸시마다 러너에서 임시 Postgres를 띄워 `db/schema.sql` + `db/seed/*.json`이 여전히 유효한지만 검증한다.

## 데이터 자동 갱신

과제 카탈로그와 평가 시장은 원본 소스가 바뀌는 속도가 달라 갱신 주기도 다르다.

- `scripts/refresh-quests.mjs` — **매일** `codyssey_Quest_Tracker`의 `docs/data/current.json`을 다시 받아
  상태 분포·PASS/FAIL·최근 변화율을 갱신한다. 최근 변화율은 `quest_completed_history`에 매일 쌓은 완료건수를
  7일 전 값과 비교하는 롤링 윈도다 — 도입 직후 7일간은 비교 대상이 없어 0%로 보이다가 이후 실제 값으로 채워진다.
- `scripts/refresh-eval-aggregate.mjs` — **매주(월요일)** `codyssey_EV_Tracker`의 최근 3개월치 월별 파일을
  다시 받아 시간대×요일 수급 히트맵과 과제별 트랙 평균 처리시간(`avg_wait_hours`)을 갱신한다. 3개월 누적
  집계라 매일 다시 계산할 이유가 없다.
- `.github/workflows/refresh-quests.yml`(매일), `refresh-eval-aggregate.yml`(매주 월요일)이 각각 실행한다.
  둘 다 저장소 시크릿 `DATABASE_URL`이 필요하고, `workflow_dispatch`로 수동 실행도 가능하다.
- 로컬에서 즉시 최신화하려면 `npm run refresh:quests` / `npm run refresh:eval`.

## 구조

```
app/                       Next.js + TypeScript 앱
  src/domain/               순수 도메인 타입 + 지표 계산 (UI 비의존)
  src/data/                 실제 데이터 로더(real-quests.ts, real-eval-aggregate.ts) — Postgres 조회
  src/lib/                  db.ts(Postgres 클라이언트), codyssey-client.ts(실시간 개인 데이터 연동)
  src/app/                  라우트 (시장개요 /, 과제시세 /quests, 평가시장 /eval-market, 내전략 /me, 레벨과시험 /level-exam)
  src/components/           신뢰도 배지, 증감 표시 등 공용 UI
  scripts/seed-db.mjs        db/schema.sql 적용 + db/seed/*.json(초기 스냅샷)을 Postgres에 적재
  scripts/refresh-quests.mjs         매일 — 과제 카탈로그/상태 분포 재수집
  scripts/refresh-eval-aggregate.mjs 매주 — 평가 시장 집계/트랙 평균처리시간 재수집
db/schema.sql              quests / eval_aggregate_meta / eval_aggregate_cells 테이블 정의
db/seed/                    커밋된 실제 데이터 스냅샷(JSON) — seed-db.mjs의 입력
docker-compose.yml          로컬 개발용 Postgres
docs/                       조사 문서, 지표 카탈로그, 데이터 소스 지도
```

## 알려진 한계

- 개인 진행 상태(`/me`, `/level-exam`의 완료·진행중 목록)는 실제 세션으로 매 요청 조회하지만, 응답 필드
  구조를 아직 검증하지 못해 Member 타입으로 매핑하지 않는다 — 원본 JSON을 접어서 보여주고, 레벨·경험치·
  완료 목록 자체는 여전히 데모 페르소나다. 필드를 확인하면 `domain/member.ts` 매핑을 채워 넣는다.
- `db/seed/*.json`은 최초 부트스트랩용 스냅샷일 뿐이다 — 실제 최신 데이터는 위 "데이터 자동 갱신" 스크립트가 채운다.
- 평가 가능 슬롯("공급") 데이터는 참조 저장소 조사 결과 안정적 수집 경로가 없는 것으로 확인됨 — 완료 처리량으로 근사(평가 시장), 트랙 평균 처리시간으로 근사(과제 시세).
- 트랙 평균 처리시간은 과제 단위가 아니라 같은 트랙 실제 이벤트의 평균이다 — 과제 13개 중 다수가 같은 트랙을 공유하므로 그 안에서는 동일한 값을 보인다.
- 최근 변화율은 `quest_completed_history`의 7일 롤링 윈도 diff다 — 자동 갱신 도입 직후 7일간은 비교 대상이 없어 0%로 보인다.
- 후속 해제 과제(선행조건 그래프)는 커리큘럼 순번(uqstnSqnt) 기반 추정이다 — 공식 의존성 API는 아직 확인되지 않았다.
- Level 5 공식 응시 조건 필드는 여전히 미발견 — inferred로 유지.
- 로그인 UI는 앱에 구현하지 않는다 — 참조 트래커들과 동일하게 사용자가 직접 로그인 후 세션 쿠키를 `.env`에 붙여넣는 방식.

## 데이터 출처와 신뢰도

모든 지표는 confirmed_api / confirmed_ui / observed / inferred / unknown 중 하나로 표시된다. 자세한 정의는 [docs/data-source-map.md](docs/data-source-map.md) 참고.
