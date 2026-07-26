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
cd app
npm install
npm run dev     # http://localhost:3000
npm run build
npm run start
```

개인 데이터 수집(선택, 본인 세션 필요 — `/me`, `/level-exam`을 실제 본인 진행 상태로 채우려면):

```bash
cp .env.example .env   # CODYSSEY_SESSION 값 채워넣기
node scripts/collect-me.mjs   # data/private/me.json 에 저장 (gitignore됨)
```

## 구조

```
app/                       Next.js + TypeScript 앱
  src/domain/               순수 도메인 타입 + 지표 계산 (UI 비의존)
  src/data/                 실제 데이터(real-quests.ts, real-eval-aggregate.ts) + 데모 페르소나(mock-member.ts)
  src/lib/                  서버 전용 유틸(개인 수집 파일 읽기 등)
  src/app/                  라우트 (시장개요 /, 과제시세 /quests, 평가시장 /eval-market, 내전략 /me, 레벨과시험 /level-exam)
  src/components/           신뢰도 배지, 증감 표시 등 공용 UI
scripts/collect-me.mjs     본인 세션으로 본인 데이터만 읽는 개인 수집기
docs/                       조사 문서, 지표 카탈로그, 데이터 소스 지도
```

## 알려진 한계

- 개인 진행 상태(`/me`, `/level-exam`의 완료·진행중 목록)는 실제 로그인 세션 없이는 알 수 없어 데모 페르소나로 대체했다. 과제 카탈로그 자체는 실제 데이터다.
- `scripts/collect-me.mjs`는 개인 프로필/시험 데이터를 실제로 수집하지만, 응답 필드 구조를 아직 검증하지 않아 `/me` 화면에는 매핑하지 않고 원본 감지 알림만 표시한다.
- 평가 가능 슬롯("공급") 데이터는 참조 저장소 조사 결과 안정적 수집 경로가 없는 것으로 확인됨 — 완료 처리량으로 근사(평가 시장), 트랙 평균 처리시간으로 근사(과제 시세).
- 트랙 평균 처리시간은 과제 단위가 아니라 같은 트랙 실제 이벤트의 평균이다 — 과제 13개 중 다수가 같은 트랙을 공유하므로 그 안에서는 동일한 값을 보인다.
- 최근 변화율은 약 6일 간격 실제 스냅샷 두 개(2026-07-20, 2026-07-26)의 완료건수 diff다 — 데이터가 갱신될수록 더 정밀한 7일 롤링 윈도로 교체할 수 있다.
- 후속 해제 과제(선행조건 그래프)는 커리큘럼 순번(uqstnSqnt) 기반 추정이다 — 공식 의존성 API는 아직 확인되지 않았다.
- Level 5 공식 응시 조건 필드는 여전히 미발견 — inferred로 유지.
- 로그인 UI는 앱에 구현하지 않는다 — 참조 트래커들과 동일하게 사용자가 직접 로그인 후 세션 쿠키를 `.env`에 붙여넣는 방식.

## 데이터 출처와 신뢰도

모든 지표는 confirmed_api / confirmed_ui / observed / inferred / unknown 중 하나로 표시된다. 자세한 정의는 [docs/data-source-map.md](docs/data-source-map.md) 참고.
