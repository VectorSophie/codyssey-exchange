# 기존 Codyssey 트래커 조사

`giyeop-cody` 소유의 5개 공개 저장소를 읽기 전용으로 조사했다 (2026-07-26, 각 저장소 `main` 기본 브랜치 shallow clone 기준).
코드를 복사하거나 병합하지 않았다. 이 문서는 Codyssey Exchange가 무엇을 어댑터로 가져올지, 무엇을 독자적으로 다시 만들어야 하는지 판단하기 위한 근거다.

## 요약 표

| 저장소 | 역할 | 핵심 산출물 | Exchange가 가져올 것 |
|---|---|---|---|
| `codyssey_commons` | 로스터 수집, 세션/로그인 공용 로직 | `roster.json`, `roster-ev.json` | 세션 만료 감지 패턴, 시즌/주차 해석 전략 (코드는 참고만) |
| `codyssey_Quest_Tracker` | 과제 진행 상태 집계 | `docs/data/current.json` | `assignments[]`(과제 마스터), `aggregates`(상태 분포 스냅샷) |
| `codyssey_EV_Tracker` | 평가 요청/완료 이벤트 | `docs/data/YYYY-MM.json` | `events[]` 구조를 PII 제거 후 평가시장 이벤트로 재사용 |
| `codyssey_Jail_Tracker` | SECOM 출입 집계 | `dashboard/data/YYYY-MM.json` | `hourly`/`weekday` 분포, 월별 매니페스트 형식 |
| `Codyssey-time-manager` | 개인 인정시간 계산 (기기 내) | 없음 (온디바이스) | 인정시간 계산 로직의 설계 원칙 (로컬 우선, 실시간 투영) |

## 저장소별 상세

### codyssey_commons — 공용 로스터/세션 모듈
- **로스터**: `GET guild/{gid}/detail?guildSeasonId=&weekNo=`를 길드별로 호출해 `mbrId` 기준으로 병합 (`roster-core.cjs`). 이메일은 수집 단계에서부터 제외.
- **시즌/주차**: env 고정값 → `guild/season/currentSeasonDetail` 자동판별 → 하드코드 기본값 순서로 해석. 길드 ID는 시즌마다 바뀌므로 수동 매핑 테이블을 유지.
- **세션 만료 감지**: HTTP 401/403 또는 3xx 리다이렉트(로그인 페이지로 튕김)를 세션 만료로 판정. `guild/{gid}/detail`은 시즌 전환기에 유효한 세션에도 400을 반환하는 사례가 있어, 검증은 `api/common/menu/my`로 별도 수행. **이 판정 로직은 Codyssey Exchange 수집기에도 그대로 채택할 가치가 있다.**
- **캐시**: 공유 로스터 허브 JSON에 8시간 TTL, 길드 호출 사이 300ms 지연.
- **재사용 가능한 부분**: 세션 검증/만료 판정 함수, "실패 시 이전 데이터 유지 + 빈 응답으로 덮어쓰지 않기" 패턴. 둘 다 순수 함수형이라 개념적으로 이식 가능.
- **재사용하면 안 되는 부분**: 길드 ID 하드코딩 매핑(시즌 종속), GitHub Secrets에 세션을 저장소 간 자동 배포하는 구조(Exchange는 별도 프로젝트이므로 불필요한 결합).

### codyssey_Quest_Tracker — 과제 진행도
- **수집 경로**: 로스터 → `ev/request/mbrSearch/searchList`(개인별 과제 상태) → `learning/learningProgress/getUqstnlist`(과제 마스터) → `learning/learningProgress/status/list`(필수 여부 오버레이) → `user/getStudyUsers/`(경험치·포인트).
- **상태 판정**: `evlStusCd` 값(`00001`/`00002`/`00003`)을 M(미진행)/E(평가중)/C(완료)로 매핑하고, 응답에 아예 없는 과제는 N(미시작)으로 **추정**한다. 즉 "미시작"은 API가 주는 값이 아니라 부재로부터의 추론이다.
- **알려진 불안정성**: `getUqstnlist.requiredYn`가 특정 배포 이후 전부 `null`로 깨져서 `status/list`로 오버레이하는 우회가 들어가 있음. `user/getStudyUsers`는 페이지네이션 없이 약 10건 캡이 있어 회원 1인당 1회 호출로 우회.
- **산출물 구조**: `assignments[]`(과제 마스터: 트랙/필수여부/학습시간), `aggregates`(과제별 상태 분포), `members[].progress`(개인별 상태), `ranks[]`.
- **중복/모델 차이**: 상태 스냅샷만 저장하고 **전이 이력이 없다** — "완료까지 걸린 시간" 같은 지표는 이 데이터만으로 계산 불가. git 커밋 이력을 diff하는 방법 외엔 시계열이 없다.
- **가져올 것**: `assignments[]`를 과제 마스터의 초기 시드로, `aggregates`를 상태 분포 스냅샷의 예시로 사용. **가져오면 안 되는 것**: N(미시작) 판정 로직을 그대로 신뢰하지 말 것 — Exchange 자체 정의로 재검증 필요.

### codyssey_EV_Tracker — 평가 이벤트
- **수집 경로**: `ev/request/mbrSearch/searchList`(목록) → `ev/request/mtlEvlTxnDtoByPkList`(평가자/점수 상세).
- **상태 판정**: 코드값이 아니라 한글 상태명 문자열("완료"/"취소"/"거절"/"진행")로 분류 — 코드 도메인이 리스트/트랜잭션 API 사이에서 서로 다른 의미로 겹쳐 쓰이기 때문. **이 교훈은 Exchange 수집기 설계에 직접 반영해야 한다.**
- **평가 가능 슬롯**: 원래 `schedule/scheduleAllList`로 수집을 시도했으나, 그 API가 세션 소유자 자신의 데이터만 반환하는 비대칭 문제로 **폐기되어 있다** (`slots: []` 하드코딩). 즉 "열린 평가 슬롯" 데이터는 현재 어떤 참조 저장소에도 없다 — Exchange가 이 기능(평가 시장의 공급 측)을 만들려면 독자적으로 API를 재조사해야 한다.
- **mbrId 검증**: 암호학적 검증 없음. 첫 두 회원의 응답 `scdlId` 집합이 동일하면 "세션 소유자 데이터만 반환됨"으로 추정하는 휴리스틱이 전부.
- **실명 관계 데이터 공개 위험 — 확인된 실제 사고**: 이 저장소는 README에서 "실명 데이터이므로 Private 운영 권장"이라고 스스로 경고하면서도, 실제로는 `docs/data/*.json`을 GitHub Pages로 공개 배포하고 있고, 조사 중 clone한 실제 데이터에서 평가자·피평가자 실명 쌍이 그대로 노출된 것을 확인했다. **Codyssey Exchange는 이 실수를 반복하면 안 된다** — 공개 산출물에서 실명은 반드시 어댑터 경계에서 제거/해시한다.
- **가져올 것**: `events[]`의 필드 구조(요청/해결 시각, 상태, 취소 주체)를 PII 제거 후 평가시장 이벤트 스키마로 재사용. **가져오면 안 되는 것**: `evaluatorName`/`evaluateeName` 원문, 슬롯 개념(애초에 없음).

### codyssey_Jail_Tracker — SECOM 출입 집계
- **로스터 병합**: `mbrId` 기준 Map 병합, 캐시 8시간, 캐시 실패 시 이전 캐시로 폴백 후에도 실패하면 throw(빈 데이터로 덮어쓰지 않음) — **이 폴백 원칙을 Exchange 수집기 표준으로 채택**.
- **자정/월 경계 미퇴실 처리**: 오늘 또는 어제(KST) 기준 세션을 "현재 재실"로 판정하고, 매월 1일에는 전월 데이터를 추가로 조회해 자정을 넘겨 아직 안 나간 사람을 놓치지 않는다.
- **익명화**: `sanitize-for-public.js`가 이메일 제거, `mbrId`를 `sha1('jail:' + mbrId)` 해시로 치환. 그러나 **실명(`mbrNm`)과 초 단위 출입 타임스탬프는 그대로 공개**되고, 해시 솔트가 고정 문자열이라 역산 가능 — 약한 익명화다. Exchange는 배포별 랜덤 솔트를 쓰고, 정밀 타임스탬프는 시간대 단위로 버킷화해야 한다.
- **GitHub Actions**: 5~6분 간격 cron 4개로 30분 주기를 근사, 수집 워크플로 성공 시 배포 워크플로를 `workflow_run`으로 트리거하는 2단계 파이프라인.
- **가져올 것**: `hourly`/`weekday` 시간대별 분포 집계 방식(평가 시장의 수요/공급 히트맵에 그대로 응용 가능), 2단계(수집→배포) Actions 구조.
- **가져오면 안 되는 것**: `_publicId` 해시 방식(고정 솔트), `currentlyInside`(실시간 재실자 노출) 같은 감시적 기능.

### Codyssey-time-manager — 개인 인정시간 계산
- 코드가 아니라 **설계 원칙**이 재사용 가치의 핵심이다. 순수 계산 모듈(`shared-attendance.js`) 하나에 모든 시간 계산 로직을 모아 확장 UI/모바일 UI가 공유한다.
- 서버 일일 인정시간 상한(12시간)을 상수로 두고, 미퇴실(퇴실 누락)은 13시간을 넘으면 "오래된 태그"로 간주해 실시간 계산에서 제외 — 무한정 카운트되는 버그를 방지.
- 자정을 넘긴 세션은 자동 판정하지 않고 사용자에게 "밤샘이었나/체크아웃 누락이었나"를 확인받는다 — **모호한 상태를 침묵 속에 추정하지 않고 명시적으로 드러내는 태도**는 Codyssey Exchange 전체의 confirmed/observed/inferred 원칙과 정확히 같은 정신이다.
- 온디바이스 저장 원칙(서버 전송 없음)은 Exchange의 개인 데이터(`private/`) 계층 설계에 참고.
- **가져올 것**: "기록이 아니라 오늘 계획의 재료"라는 프레이밍 — 개인 화면(내 전략)은 과거 총량보다 "지금부터 무엇을 할지"를 우선 노출해야 한다는 설계 원칙.

## 저장소 간 공통적으로 관찰된 문제

- **중복 수집**: 로스터 수집이 Quest/EV/Jail 트래커에서 각각 별도로 반복된다. Exchange는 `codyssey_commons`의 로스터 산출물을 그대로 입력받는 어댑터를 만들어 중복 호출을 피한다.
- **서로 다른 데이터 모델**: 세 트래커 모두 회원 식별에 `mbrId`를 쓰지만 상태 코드 체계가 저장소마다 다르고(Quest의 `evlStusCd` vs EV의 base/txn 이중 코드 도메인), 같은 숫자 코드가 다른 의미로 쓰이는 함정이 실제로 존재했다(EV Tracker 사례). Exchange의 정규화 계층은 원문 코드값과 사람이 읽는 상태명을 모두 저장해 이런 함정을 재발하지 않게 한다.
- **개인정보 위험**: EV Tracker(평가 관계 실명), Jail Tracker(정밀 출입 시각+재실 여부)가 가장 위험하다. Quest Tracker는 상대적으로 낮음(진행 상태는 본질적으로 덜 민감).
- **불안정한 API 의존성**: 비공식 엔드포인트(`requiredYn` null화, `getStudyUsers` 무페이지네이션 캡, `scheduleAllList`의 세션 소유자 편향)가 반복적으로 나타난다. Exchange는 처음부터 "이 필드는 언제든 깨질 수 있다"는 전제로 설계하고, 필드별 confirmed/inferred 표시를 데이터 모델에 내장한다.
- **장기적으로 공통 패키지로 뽑을 가치가 있는 로직**: 세션 검증/만료 판정(`session.cjs`), 시즌/주차 해석 전략, "실패 시 이전 데이터 유지" 안전장치. 이 세 가지는 Codyssey Exchange 자체 수집기에도 필요하므로, 처음부터 참고해 재구현하되 기존 저장소를 의존성으로 끌어오지는 않는다(독립 프로젝트 원칙).

## Codyssey Exchange가 어댑터로 읽을 수 있는 입력 (1단계 전략)

- `codyssey_Quest_Tracker`의 `docs/data/current.json` → 과제 마스터 시드 + 현재 상태 분포
- `codyssey_EV_Tracker`의 `docs/data/YYYY-MM.json` → 평가 이벤트(실명 필드는 어댑터에서 즉시 폐기/해시)
- `codyssey_Jail_Tracker`의 `dashboard/data/YYYY-MM.json` → 시간대별 활동 분포(학습시간 비용 추정의 보조 신호)
- `codyssey_commons`의 로스터 산출물 → 길드/회원 마스터

이 네 소스 모두 GitHub Pages/저장소에 공개된 JSON이므로, Codyssey API를 다시 호출하지 않고도 fixture로 내려받아 개발할 수 있다.
