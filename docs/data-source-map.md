# 데이터 소스 지도

## 수집 전략 3단계

1. **기존 결과 가져오기** (1단계, 최우선) — API를 다시 호출하지 않고 UI/지표 검증까지 가능해야 한다.
2. **독립 읽기 전용 수집기** — 필요할 때만, 쓰기 API 호출 금지, 캐시 우선, 세션 만료 감지, 부분 실패 표시.
3. **시험/레벨 API 발견** — 실제 화면의 정상적 네트워크 관찰 범위에서만. 무작위 퍼징·권한 우회·대량 열거 금지.

## 1단계: 기존 트래커 산출물 (즉시 사용 가능)

[[existing-trackers]] 조사 결과 기준. 아래 파일들은 각 저장소의 GitHub Pages/저장소 경로에서 fixture로 내려받아 개발에 쓴다.

| 소스 | 파일 패턴 | 제공하는 것 | 신뢰도 |
|---|---|---|---|
| `codyssey_commons` | roster hub JSON | 길드/회원 마스터 (mbrId 기준) | Confirmed by API |
| `codyssey_Quest_Tracker` | `docs/data/current.json` | 과제 마스터, 상태 분포 스냅샷, 경험치/포인트 | Confirmed(assignments) / Inferred(N=미시작) |
| `codyssey_EV_Tracker` | `docs/data/YYYY-MM.json` | 평가 요청/완료/취소 이벤트 (PII 제거 후 사용) | Confirmed(상태) / 슬롯 데이터 없음 |
| `codyssey_Jail_Tracker` | `dashboard/data/YYYY-MM.json` | 시간대별/요일별 출입 활동 분포 | Confirmed |

## 2단계: 알려진 읽기 전용 API 경로 (재검증 필요)

브리프가 제시한 경로들 — **유효성 재확인 전까지 Unknown으로 취급**:

- `/rest/secom/detail?mbrId&year&month` — Jail Tracker/Time Manager에서 실사용 확인 (Observed, 2026-07 시점)
- `/ev/request/mbrSearch/searchList` — Quest/EV Tracker 공통 실사용 확인 (Observed)
- `/ev/request/mtlEvlTxnDtoByPkList` — EV Tracker 실사용 확인 (Observed)
- `/schedule/scheduleAllList` — Time Manager는 사용 중이나, EV Tracker는 "세션 소유자 데이터만 반환"하는 비대칭 문제로 **슬롯 수집 용도로는 폐기**. 개인 일정 알림 용도로는 유효.
- `/learning/learningProgress/getUqstnlist`, `/learning/learningProgress/status/list` — Quest Tracker 실사용, 단 `requiredYn` 필드가 배포 중 깨진 이력 있음 (필드 단위 불안정성 있음)
- `/user/getStudyUsers` — 실사용, 페이지네이션 없이 ~10건 캡

이 경로들은 모두 "비공식"이다. Exchange 자체 수집기를 만들 때는 각 호출 전후로 세션 유효성을 검증하고, 실패 시 이전 캐시를 유지한다(덮어쓰지 않음).

## 3단계: 시험/레벨 API

2026-07-26 실제 로그인 세션(`usr.codyssey.kr`)에서 정상적인 화면 탐색 범위 내 네트워크 관찰로 아래 엔드포인트를 확인했다. 무작위 퍼징이나 권한 우회 없이, 본인 계정으로 접근 가능한 화면만 클릭해 확인함.

| 경로 | 화면 | 확인 내용 | 등급 |
|---|---|---|---|
| `GET /rest/user/info/detail` | MY → 내 정보 | 레벨(Lv.3), 평가 포인트(400), 크레딧 | Confirmed by API |
| `POST /exam/usr/list` | 시험 → 접수 | 현재 응시 가능한 시험 목록. 조사 시점 Lv.3 계정은 0건("응시할 시험이 없습니다") | Confirmed by API |
| `POST /exam/usr/result/list` | 시험 → 결과 | 응시 이력(합격여부/점수), 필터: 시험명/접수상태/시험평가일 | Confirmed by API |
| `GET /learning/learningProgress/child/list?lpNo={projectNo}` | 학습 → 학습맵(예: `projectNo=136003`) | 커리큘럼 단계별 선행조건 그래프 데이터 — 화면은 헥사곤 노드(B1-1, B1-2...)로 잠김/완료/현재 위치를 시각화 | Confirmed by API |
| `GET /learning/usr/ai/check-ip` | 학습맵 진입 시 | 용도 불명(접속 IP 검증으로 추정, 시험 부정행위 방지 목적일 가능성) | Observed |

**미발견/추가 조사 필요**:
- Level 5 공식 응시 조건을 직접 반환하는 필드 — 위 어떤 응답에도 "다음 레벨 조건"을 명시하는 필드는 아직 못 찾음. `learningProgress/child/list` 응답의 필드 구조를 상세 파싱해야 확정 가능.
- 시험 합격 기준, 과제별 공식 보상 — 미발견.
- 실제 학습맵 화면은 "소유자격 없음" 배지를 보여줌 — 레벨/자격 개념이 분리되어 있을 가능성 시사(Inferred).

이 조사가 끝나기 전까지 Level 5 응시 조건 관련 모든 데이터는 데이터 모델에서 `confidence: "inferred"` 또는 `"unknown"`으로 명시하고, 화면에도 동일하게 노출한다.

## 데이터 신뢰도 등급 (전 지표 공통)

- **Confirmed by API** — 공식 필드에서 직접 옴
- **Confirmed by UI** — 화면 관찰로 확인, API 필드명 불명
- **Observed** — 반복 관찰로 패턴 확인, 예외 가능성 있음
- **Inferred** — 여러 사용자 상태의 교차 비교로 역추정
- **Unknown** — 아직 근거 없음
