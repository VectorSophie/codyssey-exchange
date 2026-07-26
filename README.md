# Codyssey Exchange

코디세이 학습 활동(과제 진행, 평가 요청, 출입 기록, 레벨/시험)을 수요-공급-병목-진척이라는 경제 시장의 정보 문법으로 설명하는 학습 분석 도구다.
실제 화폐, 투자수익률, 매수/매도는 다루지 않는다 — 빌리는 것은 정보 구조뿐이다.

## 현재 상태

Phase 0(조사), Phase 2(mock vertical slice), Phase 3/4 일부(평가 시장, 내 전략, 레벨과 시험)가 동작한다.
시장 개요/과제 시세/과제 상세/내 전략/레벨과 시험은 mock 데이터, **평가 시장은 실제 데이터**(codyssey_EV_Tracker 공개 저장소를 PII 제거 후 집계)로 동작한다.

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

개인 데이터 수집(선택, 본인 세션 필요):

```bash
cp .env.example .env   # CODYSSEY_SESSION 값 채워넣기
node scripts/collect-me.mjs   # data/private/me.json 에 저장 (gitignore됨)
```

## 구조

```
app/                       Next.js + TypeScript 앱
  src/domain/               순수 도메인 타입 + 지표 계산 (UI 비의존)
  src/data/                 mock 데이터 + 실제 집계 데이터(real-eval-aggregate.ts)
  src/lib/                  서버 전용 유틸(개인 수집 파일 읽기 등)
  src/app/                  라우트 (시장개요 /, 과제시세 /quests, 평가시장 /eval-market, 내전략 /me, 레벨과시험 /level-exam)
  src/components/           신뢰도 배지, 증감 표시 등 공용 UI
scripts/collect-me.mjs     본인 세션으로 본인 데이터만 읽는 개인 수집기
docs/                       조사 문서, 지표 카탈로그, 데이터 소스 지도
```

## 알려진 한계

- 과제/시장 데이터는 아직 mock. 평가 시장만 실제 공개 데이터를 사용(집계만, PII 제거).
- `scripts/collect-me.mjs`는 개인 프로필/시험 데이터를 실제로 수집하지만, 응답 필드 구조를 아직 검증하지 않아 `/me` 화면에는 매핑하지 않고 원본 감지 알림만 표시한다.
- 평가 가능 슬롯("공급") 데이터는 참조 저장소 조사 결과 안정적 수집 경로가 없는 것으로 확인됨 — 완료 처리량으로 근사.
- Level 5 공식 응시 조건 필드는 여전히 미발견 — inferred로 유지.
- 로그인 UI는 앱에 구현하지 않는다 — 참조 트래커들과 동일하게 사용자가 직접 로그인 후 세션 쿠키를 `.env`에 붙여넣는 방식.

## 데이터 출처와 신뢰도

모든 지표는 confirmed_api / confirmed_ui / observed / inferred / unknown 중 하나로 표시된다. 자세한 정의는 [docs/data-source-map.md](docs/data-source-map.md) 참고.
