# Codyssey Exchange

코디세이 학습 활동(과제 진행, 평가 요청, 출입 기록, 레벨/시험)을 수요-공급-병목-진척이라는 경제 시장의 정보 문법으로 설명하는 학습 분석 도구다.
실제 화폐, 투자수익률, 매수/매도는 다루지 않는다 — 빌리는 것은 정보 구조뿐이다.

## 현재 상태

Phase 0(조사)와 Phase 2(mock 데이터 vertical slice)가 완료되었다. 시장 개요와 과제 시세/과제 상세가 한국어 mock 데이터로 동작한다.

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

## 구조

```
app/                       Next.js + TypeScript 앱
  src/domain/               순수 도메인 타입 + 지표 계산 (UI 비의존)
  src/data/                 mock 데이터
  src/app/                  라우트 (시장 개요 /, 과제 시세 /quests, 과제 상세 /quests/[id])
  src/components/           신뢰도 배지, 증감 표시 등 공용 UI
docs/                       조사 문서, 지표 카탈로그, 데이터 소스 지도
```

## 알려진 한계

- 실제 Codyssey API 수집기는 아직 없다 (mock 데이터만 사용). [[docs/data-source-map.md]] 2·3단계 참고.
- 평가 가능 슬롯("공급") 데이터는 참조 저장소 조사 결과 안정적 수집 경로가 없는 것으로 확인됨 — 재조사 필요.
- 시험/레벨 API는 전부 미발견 — 실제 세션으로 네트워크 관찰 필요.

## 데이터 출처와 신뢰도

모든 지표는 confirmed_api / confirmed_ui / observed / inferred / unknown 중 하나로 표시된다. 자세한 정의는 [docs/data-source-map.md](docs/data-source-map.md) 참고.
