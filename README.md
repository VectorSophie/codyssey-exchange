# Codyssey Exchange

코디세이 학습 활동(과제 진행, 평가 요청, 출입 기록, 레벨/시험)을 수요-공급-병목-진척이라는 경제 시장의 정보 문법으로 설명하는 학습 분석 도구입니다.
실제 화폐, 투자수익률, 매수/매도는 다루지 않습니다 — 빌리는 것은 정보 구조뿐입니다.

## 현재 상태

**과제 카탈로그(13개, AI/SW 기초), 상태 분포, PASS/FAIL, 최근 변화, 평가 시장 히트맵은 전부 실제 공개 데이터로 동작합니다.**

- 시장 개요 / 과제 시세 / 과제 상세: 코디세이 API에서 직접 수집한 시즌 길드 전원의 과제 상태 분포·PASS/FAIL·트랙별 평균 처리시간(과제 이름·공식 학습시간은 `codyssey_Quest_Tracker` 스냅샷)
- 평가 시장: 같은 수집에서 최근 90일 평가 세션의 요청·처리 시각을 시간대×요일로 집계(PII 제거)
- 내 전략 / 레벨과 시험: 과제 카탈로그는 실제 데이터, 본인 세션을 연결하면 레벨·경험치·포인트·닉네임·완료
  및 진행중 과제 목록·레벨 분포까지 실제 데이터로 나옵니다. 세션이 없으면 **데모 페르소나**로 폴백합니다.

- [DATA.md](DATA.md) — 모든 데이터의 출처·엔드포인트·필드 의미·검증 이력
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
cp .env.example .env.local       # DATABASE_URL 채우기 (docker-compose 기본값 그대로면 됩니다)
npm run db:seed                  # db/seed/*.json(실제 데이터 스냅샷) 적재
npm run dev                      # http://localhost:3000
npm run build
npm run start
```

개인 데이터 실시간 연동(선택 — `/me`, `/level-exam`을 실제 본인 진행 상태로 채우려면): `.env.local`에
`CODYSSEY_SESSION`을 채워 넣습니다(브라우저 로그인 후 JSESSIONID 쿠키 복사, 아래 알려진 한계 참고). 비워두면
데모 페르소나로 자동 폴백합니다. 배포된 사이트에서는 방문자가 직접 화면의 팝업에 본인 JSESSIONID를
붙여넣을 수 있습니다(브라우저 쿠키에만 저장, 서버에는 남지 않습니다). 별도 수집 스크립트는 없습니다 —
서버가 매 요청마다 직접 조회합니다.

배포 시 DB는 관리형 Postgres(Neon/Supabase 등 무료 티어)를 권장합니다 — "GitHub 러너 안의 DB"나 로컬
docker는 개발/CI 검증용이지 배포 서버가 상시 붙잡고 있을 대상이 아닙니다. `.github/workflows/db-check.yml`은
매 푸시마다 러너에서 임시 Postgres를 띄워 `db/schema.sql` + `db/seed/*.json`이 여전히 유효한지만 검증합니다.

## 데이터 자동 갱신

`scripts/collect-live.mjs`(`npm run collect`)가 코디세이 API에서 직접 수집해 과제 시세와 평가 시장을 한 번에
갱신합니다. 원래 원천이던 공개 트래커(`codyssey_Quest_Tracker`, `codyssey_EV_Tracker`)가 2026-08-12에 멈춰서 같은
정의로 다시 만든 것입니다 — 정의와 근거는 [DATA.md](DATA.md) 8절.

- 시즌 길드 전원(2026-10-21 기준 357명)의 평가 목록 + 최근 90일 평가 상세를 읽고 집계만 DB에 씁니다. 약 4분 걸립니다.
- `npm run collect -- --dry-run`이면 DB에 쓰지 않고 집계만 출력합니다.
- `.github/workflows/collect.yml`이 매일 04:00 KST에 실행합니다. 저장소 시크릿 `DATABASE_URL`과 `CODYSSEY_SESSION`
  (로그인 쿠키 문자열)이 필요합니다. 세션이 만료되면 잡은 실패하고 DB는 마지막 수집 상태로 남습니다.
- 최근 변화율은 `quest_completed_history`에 매일 쌓은 완료 수를 7일 전 값과 비교합니다 — 수집 전환(2026-10-21) 직후
  7일간은 0%로 보입니다.

## 구조

```
app/                       Next.js + TypeScript 앱
  src/domain/               순수 도메인 타입 + 지표 계산 (UI 비의존)
  src/data/                 실제 데이터 로더(real-quests.ts, real-eval-aggregate.ts) — Postgres 조회
  src/lib/                  db.ts(Postgres 클라이언트), codyssey-client.ts(실시간 개인 데이터 연동 + 매핑)
  src/app/                  라우트 (시장개요 /, 과제시세 /quests, 평가시장 /eval-market, 내전략 /me, 레벨과시험 /level-exam)
  src/components/           신뢰도 배지, 증감 표시, 세션 입력 팝업 등 공용 UI
  scripts/seed-db.mjs        db/schema.sql 적용 + db/seed/*.json(초기 스냅샷)을 Postgres에 적재
  scripts/collect-live.mjs   매일 — 코디세이 API 직접 수집(과제 상태 분포 + 평가 시장)
db/schema.sql              quests / eval_aggregate_meta / eval_aggregate_cells / quest_completed_history 테이블 정의
db/seed/                    커밋된 실제 데이터 스냅샷(JSON) — seed-db.mjs의 입력
docker-compose.yml          로컬 개발용 Postgres
docs/                       조사 문서, 지표 카탈로그, 데이터 소스 지도
```

## 알려진 한계

- 실제 세션 연동 시 매핑되는 필드(전부 2026-07-30 실사용자 세션으로 검증, `lib/codyssey-client.ts`):
  - `point/pnt/total/detail` → 레벨·경험치·포인트·다음 레벨 요구 경험치. `rest/user/info/detail`의
    `instList[0].level`은 의도적으로 쓰지 않습니다 — 실사용자 검증 결과 화면 레벨 배지와 다른 값이었습니다
    (실제 Lv.4 계정에 `level: "32"`가 옴 — 다른 의미의 카운터로 추정되나 무엇인지 미확인).
  - `learning/learningProgress/status/list` → 과제별 완료(`PASS`)/진행중(`평가전`, 제출 후 평가 대기)
    상태. 완료·진행중 과제 목록을 이걸로 채웁니다.
  - 레벨 분포는 시즌의 전체 길드(`guild/season/currentSeasonDetail` → `guild/ranking/weeklyList` →
    길드별 `guild/{id}/detail`)를 순회해 만드는 실시간 집계입니다 — 각 길드 상세 응답에 회원 실명/이메일이
    포함되어 있지만 `level` 필드만 뽑고 즉시 버립니다(원본은 어디에도 저장하지 않음).
  - 레벨 분포는 과정(올인원/네이티브)·기수(1기/2기)별로 나뉩니다. 과정은 세션 계정의 기관명, 기수는 1기 명단
    (2026-08-12 Quest Tracker 스냅샷) 대조로 판정합니다 — 근거와 검증은 [DATA.md](DATA.md) 6절.
  - 관심 과제(watchlist)는 대응하는 API를 찾지 못해 필드 자체를 없앴습니다(예전엔 항상 빈 데모 값).
  - 미션 단계별 지급 경험치(`MISSION_TIER_XP`)와 Level 4 도달 경험치는 API로 찾지 못해 여전히 사용자가
    인게임에서 직접 확인한 값(observed/unknown)입니다. Level 5 도달 경험치(8,800)는 `nextLvlRequiredExprc`로
    확인되어 confirmed_api로 올렸습니다.
- 세션이 없으면 위 모든 필드가 데모 페르소나로 폴백합니다.
- `db/seed/*.json`은 최초 부트스트랩용 스냅샷입니다 — 실제 최신 데이터는 위 "데이터 자동 갱신" 스크립트가 채웁니다.
- 평가 가능 슬롯("공급") 데이터는 참조 저장소 조사 결과 안정적 수집 경로가 없는 것으로 확인되었습니다 — 완료 처리량으로 근사(평가 시장), 트랙 평균 처리시간으로 근사(과제 시세).
- 트랙 평균 처리시간은 과제 단위가 아니라 같은 트랙 실제 이벤트의 평균입니다 — 과제 13개 중 다수가 같은 트랙을 공유하므로 그 안에서는 동일한 값을 보입니다.
- 최근 변화율은 `quest_completed_history`의 7일 롤링 윈도 diff입니다 — 자동 갱신 도입 직후 7일간은 비교 대상이 없어 0%로 보입니다.
- 후속 해제 과제(선행조건 그래프)는 커리큘럼 순번(uqstnSqnt) 기반 추정입니다 — 공식 의존성 API는 아직 확인되지 않았습니다.
- Level 5 시험 응시 조건 자체(경험치만으로 충분한지 별도 심사가 있는지)는 여전히 미확인이라, 실제 세션이
  있어도 그 판정은 observed로 유지합니다(필드는 실제, 규칙은 미검증).
- 로그인 UI는 앱에 구현하지 않습니다 — 참조 트래커들과 동일하게 사용자가 직접 로그인 후 세션 쿠키를 붙여넣는 방식입니다(로컬은 `.env.local`, 배포본은 화면의 세션 입력 팝업).

## 데이터 출처와 신뢰도

모든 지표는 confirmed_api / confirmed_ui / observed / inferred / unknown 중 하나로 표시됩니다. 자세한 정의는 [docs/data-source-map.md](docs/data-source-map.md)를 참고하세요.
