# Codyssey Exchange 데이터 해설서

이 문서는 Codyssey Exchange가 보여주는 **모든 데이터가 어디서 왔고, 어떤 명령/엔드포인트로 얻었고, 각
필드·라벨이 무엇을 뜻하며, 그걸 어떻게 알아냈는지**를 한곳에 모은 기록입니다. 2026-07-26 프로젝트 시작부터
2026-10-21까지의 관측·검증·정정 이력을 포함합니다. 개요와 실행 방법은 [README.md](README.md)를, 설계 배경은
[docs/](docs/)를 참고하세요.

신뢰도 표기는 앱 전체와 같습니다.

| 등급 | 코드 값 | 뜻 |
|---|---|---|
| API 확인 | `confirmed_api` | 공식 API 응답 필드에서 직접 확인 |
| 화면 확인 | `confirmed_ui` | 화면에서 직접 봤지만 API 필드명은 모름 |
| 관측됨 | `observed` | 사용자가 인게임에서 직접 확인했거나 반복 관찰한 값 |
| 추정 | `inferred` | 여러 데이터를 교차해 역추정한 값 |
| 확인 불가 | `unknown` | 근거 없음 또는 전해 들은 값(2차 정보) |

---

## 1. 한눈에 보기

| 화면 | 경로 | 보여주는 것 | 원천 | 갱신 | 상태(2026-10-21) |
|---|---|---|---|---|---|
| 시장 개요 | `/` | 시간대별 수요·공급 교차 그래프, 요일별 수급, 병목지수 상위 과제, 티커 카드 | DB(`quests`, `eval_aggregate_*`) | 매일 | 2026-10-21부터 직접 수집(8절) |
| 과제 시세 | `/quests` | 도구학습 13개 과제의 상태 분포·PASS/FAIL·병목지수·변화율 | DB `quests` | 매일 | 같음(1기+2기 357명 기준) |
| 과제 상세 | `/quests/[id]` | 과제 하나의 상태 분포 막대·지표 | DB `quests` | 매일 | 같음 |
| 평가 시장 | `/eval-market` | 시간대×요일 수급 히트맵, 요일별 수급 | DB `eval_aggregate_*` | 매일 | 같음(최근 90일) |
| 내 전략 | `/me` | 남은 과제에 대한 5가지 추천 경로 | DB + 실시간 본인 세션 | 요청마다 | 정상(세션 필요) |
| 레벨과 시험 | `/level-exam` | 본인 레벨·경험치, 길드 전체 레벨 분포(과정·기수별), 미션별 경험치 | 실시간 세션 + 상수 | 요청마다 | 정상(세션 필요) |

데이터 원천은 세 종류입니다.

1. **코디세이 API**(`https://api.usr.codyssey.kr/`) — 두 가지 방식으로 씁니다. (a) 매일 수집기
   (`scripts/collect-live.mjs`)가 길드 전원의 과제 상태와 평가 세션을 모아 DB에 집계를 씁니다. (b) 방문자(또는 서버
   env)의 세션으로 매 요청 본인 레벨·과제 상태와 길드 레벨 분포를 조회합니다.
2. **공개 트래커 저장소**(`giyeop-cody/*`) — 다른 수강생이 운영하던 수집기의 공개 JSON. 2026-08-12에 멈췄고, 지금은
   과제 이름·공식 학습시간(seed)과 1기 명단에만 남아 있습니다.
3. **사용자 인게임 관측** — API로 찾지 못한 값(미션별 경험치 등). 출처와 확인 경로를 4절에 기록합니다.

---

## 2. 인증과 세션

### 세션 얻는 법

1. 크롬에서 `usr.codyssey.kr`에 로그인합니다.
2. `F12` → **Application** → **Cookies** → `https://api.usr.codyssey.kr`에서 값을 복사합니다. 또는 **Network**
   탭에서 `api.usr.codyssey.kr` 요청을 하나 골라 Request Headers의 `Cookie` 전체를 복사합니다.
3. 쿠키는 `_kmpid`, `XSRF-TOKEN`, `JSESSIONID` 세 개입니다. **실제 세션은 `JSESSIONID`**이고, `XSRF-TOKEN`은
   POST 요청에 필요합니다. `_kmpid`는 분석용 쿠키로 보이며 없어도 됩니다. 이름은 JWT로 부르기도 했지만
   실제로는 JWT가 아니라 서버 세션 ID입니다(`Authorization` 헤더는 쓰지 않음).
4. 로그아웃하면 세션이 즉시 무효가 됩니다.

### 앱에서의 사용

- 로컬: `app/.env.local`의 `CODYSSEY_SESSION="<쿠키 문자열>"`(git에 올라가지 않음).
- 배포본: 화면의 세션 입력 팝업(`components/SessionPrompt.tsx`)이 방문자 브라우저에 `codyssey_session` 쿠키로
  저장합니다(30일). 서버는 그 값을 저장하지 않고 매 요청 API 호출에만 전달합니다. 방문자 쿠키가 서버 env보다
  우선합니다 — 공개 배포에서 한 사람의 계정 데이터가 모두에게 보이지 않게 하기 위해서입니다(2026-07-30 결정).

### 호출 규칙

| 항목 | 값 |
|---|---|
| GET | `Cookie` 헤더만 |
| POST | `Cookie` + `X-XSRF-TOKEN: <쿠키의 XSRF-TOKEN>` + `X-Requested-With: XMLHttpRequest` + `Content-Type: application/x-www-form-urlencoded` (프론트 번들의 axios 인터셉터와 동일) |
| 성공 응답 | `{"code":200,"message":"OK","errors":null,"result":…}` |
| 세션 만료 | JSON 대신 `302 → https://api.usr.codyssey.kr/login`. Node `fetch`는 기본으로 리다이렉트를 따라가 로그인 HTML(`<!doctype…`)을 받거나 멈출 수 있어 `redirect: "manual"`과 타임아웃을 거는 것이 안전합니다. 앱 로그의 `Unexpected token '<'`가 바로 이 경우입니다 |

세션 확인 한 줄:

```bash
curl -s -H "Cookie: $CODYSSEY_SESSION" -w "\n%{http_code}\n" \
  https://api.usr.codyssey.kr/guild/season/currentSeasonDetail
# 200 + JSON이면 유효, 302면 만료
```

---

## 3. 엔드포인트 사전

### 3.1 엔드포인트를 찾은 방법

| 시기 | 방법 | 찾은 것 |
|---|---|---|
| 2026-07-26 | 본인 계정으로 로그인한 브라우저(Claude in Chrome)에서 화면을 정상적으로 클릭하며 네트워크 요청 관찰 | `rest/user/info/detail`, `exam/usr/list`, `exam/usr/result/list`, `learningProgress/child/list`, `usr/ai/check-ip` |
| 2026-07-26 | 공개 트래커 5개 저장소 코드 읽기([docs/research/existing-trackers.md](docs/research/existing-trackers.md)) | 길드·평가·출입·과제 마스터 경로 |
| 2026-07-30 | 실제 세션으로 응답 필드와 화면 배지 대조 | `point/pnt/total/detail`, `learningProgress/status/list`, 길드 3종 |
| 2026-10-21 | 프론트 번들 분석 — `https://usr.codyssey.kr/` → `/assets/index-*.js`(약 5MB, 한 줄)에서 `"/guild…"`, `"/learning…"`, `"/rest…"`, `"/point…"` 문자열과 주변 코드(메서드·파라미터) 추출 | 전체 경로 목록, POST 헤더 규칙 |

번들은 한 줄이라 `grep -o '.{0,200}패턴'`이 매우 느립니다. Node로 `indexOf` 주변만 잘라 보는 편이 빠릅니다.

```bash
curl -s https://usr.codyssey.kr/ | grep -oE 'src="[^"]+\.js"'      # 번들 파일명
curl -s https://usr.codyssey.kr/assets/index-XXXX.js -o main.js
node -e 'const s=require("fs").readFileSync("main.js","utf8");
  for (const p of ["guild/ranking/weeklyList"]) { const i=s.indexOf(p); console.log(s.slice(i-250,i+300)); }'
```

아카이브된 트래커들은 엔드포인트 주소를 지웠지만 경로 문자열은 코드에 남아 있습니다.

### 3.2 앱이 실제로 쓰는 엔드포인트

| 엔드포인트 | 파라미터 | 쓰는 곳 | 쓰는 필드 |
|---|---|---|---|
| `GET rest/user/info/detail` | — | `/me`, `/level-exam` | `result.mbrNm`(닉네임), `result.mbrId`, `result.instList[0].instCd`/`instNm`(과정 판정) |
| `GET point/pnt/total/detail` | — | `/me`, `/level-exam` | `result.level`, `exp`, `pnt`, `nextLvlRequiredExprc` |
| `GET learning/learningProgress/status/list` | — | `/me`, `/level-exam` | `result.uqstns[].uqstnNo`, `uqstnResultYn` |
| `GET guild/season/currentSeasonDetail` | — | `/level-exam` | `guildSeasonId`, `currentWeekNo` |
| `GET guild/ranking/weeklyList` | `guildSeasonId`, `weekNo` | `/level-exam` | `rankings[].guildId` |
| `GET guild/{guildId}/detail` | `guildSeasonId`, `weekNo` | `/level-exam` | `members[].mbrId`(기수 판정용), `members[].level` |

### 3.3 수집기·분석에 쓴 엔드포인트 (화면에서 직접 호출하지는 않음)

| 엔드포인트 | 파라미터 | 얻은 것 |
|---|---|---|
| `POST ev/request/mbrSearch/searchList` | `mbrId`, `instCd`, `page=1`, `pagePerRows=200`, `orderBy=DESC` | 한 회원의 평가 기록 전체: `projectNo`, `projectNm`, `lcorsNo`, `lcorsNm`, `uqstnNo`, `uqstnNm`, `evlStusCd`/`evlStusNm`, `passedYn`, `evlScr`, `evlBgngDt`, `evlEndDt`, `total`. 357명 조회 시 잘린 응답(`total` > 행 수) 0건. **수집기가 사용** |
| `POST ev/request/mtlEvlTxnDtoByPkList` | `evlNo`, `evlDegr` | 평가 한 건(과제 1회 평가)을 이루는 동료 평가 세션 행들: `mtlEvlSn`(세션 ID), `regDt`(요청·예약 시각), `mtlEvlPamBgngDt`(예약 슬롯 시각, 보통 정시·30분), `mtlEvlBgngDt`/`mtlEvlEndDt`(실제 시작·종료), `mtlEvlStusCd`/`mtlEvlStusNm`. 평가자 실명·mbrId·점수·피드백도 들어 있어 수집기는 시각·상태만 읽고 버립니다. 아직 끝나지 않은 평가(대기중/진행중)는 **끝난 세션만** 나옵니다(2026-10-21, 열린 평가 28건 확인). **수집기가 사용** |
| `POST point/exp/list` | JSON 본문 `{page, pagePerRows, mbrId, instCd}` (`Content-Type: application/json`) | **본인 경험치 적립 내역 전체**: `regDt`, `exprcScr`(점수), `exprcTypeNo`(종류), `exprcDtlDesc`(설명). 2026-10-21 본인 70건, 합계 18,056 = 현재 `exp`와 정확히 일치. 5.3·5.4절 미션별 XP 확정에 사용. 평가요청취소 행의 설명에는 상대 실명이 들어 있어 설명 원문은 쓰지 않습니다 |
| `GET point/exp/total/detail` | — | `point/pnt/total/detail`과 같은 `level`/`exp`/`nextLvlRequiredExprc`/`levelRegDt` |
| `GET rest/secom/detail` | `mbrId`, `year`, `month` | 출입(SECOM) 기록 — Jail Tracker·Time Manager가 사용. 7월 장학금 자격 계산(7.2절)의 원천 |

### 3.4 확인했지만 쓰지 않는 것

| 엔드포인트/필드 | 확인 내용 |
|---|---|
| `rest/user/info/detail.instList[0].level` | 화면 레벨과 다른 값(Lv.4 계정에 `"32"`, 2026-10-21 Lv.6+ 계정에 `"91"`). 의미 불명 — 레벨로 쓰지 않습니다 |
| `rest/user/info/detail.instList[0].exp` | 누적 경험치. 2026-10-21 `point/pnt/total/detail.exp`와 같은 18,056 확인 |
| `point/pnt/total/detail.levelRegDt` | 현재 레벨에 도달한 시각. 한 번 화면에 넣었다가 필요 없다는 결정으로 되돌림(커밋 `c00e09a`). 레벨업 시각 검증(5.2절)에는 사용 |
| `POST exam/usr/list`, `POST exam/usr/result/list` | 응시 가능 시험·응시 이력. Lv.3 계정은 0건 |
| `GET learning/learningProgress/child/list?lpNo={projectNo}` | 학습맵(헥사곤 노드 B1-1, B1-2…)의 선행조건 그래프 데이터. 실제로는 과제 간 선행조건이 없음(5.5절) |
| `GET learning/usr/ai/check-ip` | 학습맵 진입 시 호출, 용도 불명 |
| `POST learning/learningProgress/getUqstnlist` | `projectNo`, `lcorsNo`, `teamSn=0`. 예전 과제 마스터 원천이지만 2026-10-21 기준 빈 목록. `requiredYn`은 2026-07-24 배포 이후 전부 `null`(Quest Tracker 기록) |
| `GET learning/learningProgress/allLearningList` | 404 |
| `GET rest/code/list?groupCd=…` | `INST`, `INST_CD`, `COHORT`, `CLASS` 모두 빈 목록 — 기관·기수 코드 없음 |
| `guild/{id}/detail.members[].classNm` | 357명 전원 `null` — 기수 정보 없음 |
| `instCd` 파라미터(길드 API) | `00019`~`00023` 어느 값을 넣어도 응답 동일 → 무시됨. 길드 API는 **세션 계정의 기관** 길드만 반환 |
| `POST user/getStudyUsers/` | `search`(2자 이상) 이름 검색, 최대 10건, 페이지네이션 없음. 길드 밖 인원을 찾으려고 이름으로 검색하는 것은 개인정보 처리 문제로 하지 않았습니다 |
| `schedule/scheduleAllList` | 평가 슬롯 — 세션 소유자 본인 데이터만 반환해서 "열린 평가 슬롯" 수집에 쓸 수 없음(EV Tracker에서 폐기) |
| `point/pnt/list` | 포인트 내역(`crtrTypeCd` 필터). 2026-07-30엔 `point/exp/list`도 "미션 단위 값 없음"으로 넘겼지만, 2026-10-21 평가 기록과 시각을 맞추면 과제별로 대응된다는 걸 확인(5.4절) |
| `POST user/inst/update`, 각종 `…/save`, `…/update` | 쓰기 API — 호출하지 않습니다 |

---

## 4. 라벨·코드 사전

### 4.1 기관·단계·과제

| 값 | 뜻 | 근거 |
|---|---|---|
| `instCd 00021` | AI올인원 본과정 | `instList[0].instNm` |
| `projectNo 136003` | **AI 도구 학습** 단계 | `searchList.projectNm` |
| `projectNo 136002` | **AI 심화 학습** 단계 | `searchList`·`status/list`의 `projectNm` |
| `lcorsNo 1122015`~`1122021` | 도구학습 트랙 7개(아래 표) | `searchList.lcorsNm` |
| `lcorsNo 1122008`~`1122014` | 심화학습 트랙(데이터 분석, AI 수학, 컴퓨터 비전, 자연어 처리, 머신러닝, 딥러닝, Term Project) | `status/list` |

AI 도구 학습 과제 전체(`uqstnNo`, Quest Tracker `assignments[]`, 2026-08-12):

| 트랙(lcors) | 단계 | uqstnNo | 필수 | 공식 학습시간 | 과제 |
|---|---|---|---|---|---|
| Linux와 OS | 1-1 | 185004 | Y | 40분 | 컴퓨터가 알아서 자기 상태를 점검하게 만들기 |
| | 1-2 | 185005 | Y | 40분 | 컴퓨터가 갑자기 느려지거나 멈췄을 때 원인 찾아 고치기 |
| Python과 Git 심화 | 2-1 | 185006 | Y | 60분 | 나만의 용돈 기입장 프로그램 만들기 |
| | 2-2 | 185007 | Y | 20분 | 친구 3~5명과 함께 프로그램 만드는 법 연습하기 |
| 자료구조와 알고리즘 | 3-1 | 185008 | Y | 80분 | 정보를 엄청 빠르게 찾아주는 작은 저장소 만들기 |
| | 3-2 | 185009 | Y | 80분 | 파일이 언제 어떻게 바뀌었는지 기록하는 작은 프로그램 만들기 |
| 웹 기초와 프론트엔드 | 4-1 | 185010 | Y | 80분 | 나를 소개하는 웹페이지 처음부터 만들기 |
| | 4-2 | 185011 | N | 80분 | 버튼 누르면 화면이 스르륵 바뀌는 요즘 웹사이트 만들기 |
| 데이터베이스와 백엔드 | 5-1 | 185012 | Y | 40분 | 정보를 깔끔하게 정리하는 디지털 서랍장 만들기 |
| | 5-2 | 185013 | N | 60분 | 글을 쓰고·보고·고치고·지울 수 있는 게시판형 웹 서비스 만들기 |
| | 5-3 | 185014 | N | 60분 | 로그인이 되고 회원끼리 연결되는 웹 서비스 만들기 |
| 클라우드와 AI API | 6-1 | 185015 | Y | 40분 | 내가 만든 웹사이트를 인터넷에 올려 누구나 쓰게 하기 |
| | 6-2 | 185016 | Y | 40분 | 내가 고친 코드 설명을 AI가 대신 써주는 도우미 만들기 |
| AI/SW 기초 Term Project | — | 185017 | Y | 120분 | 웹 기반 AI 챗봇 서비스 개발 프로젝트 |
| | — | 185018 | N | 120분 | 웹 기반 AI 챗봇 서비스 고도화 프로젝트 |

- **"단계" 열(1-1, 2-2…)은 추정입니다.** 사용자가 쓰는 미션 번호(학습맵 헥사곤 B1-1, B1-2…)를 트랙 순서(`lcorsNo`
  오름차순)와 트랙 안 순번(`uqstnSqnt`)으로 맞췄습니다. 근거: 5단계만 미션이 3개(5-1/5-2/5-3)인 것과 DB 트랙만
  과제가 3개인 것이 일치하고, 5.4절의 경험치 규칙이 이 대응에서 성립합니다.
- **필수 여부**: Quest Tracker `requiredYn`과 `db/seed/quests.json`의 `required`가 일치. 도구학습 필수는 미션 10개 +
  텀프로젝트 185017입니다.
- 앱의 과제 카탈로그는 13개입니다(텀프로젝트 2개는 Quest Tracker 집계에 있지만 seed 시점 카탈로그엔 없었음).

### 4.2 상태 값

| 필드 | 값 | 뜻 | 출처 |
|---|---|---|---|
| `status/list.uqstnResultYn` | `"PASS"` | 완료 | 2026-07-30 화면 대조 |
| | `"평가전"` | 제출 후 평가 대기 → 앱은 "진행중" | 같음 |
| | `null` | 미시작 | 같음 |
| `status/list.requireYn` | `"Y"`/`"N"` | 필수/선택 | 응답 |
| `searchList.evlStusCd` / `evlStusNm` | `00003` "완료", "대기중" 등 | 평가 상태 | 응답 |
| `searchList.passedYn` | `"Y"`/`"N"` | 그 평가 통과 여부 | 본인 계정에서 화면 "완료"와 일치 |
| `searchList.evlBgngDt` / `evlEndDt` | `"2026-10-10 21:30:41"` | 그 과제 평가의 시작·최종 종료 시각(KST). 대기중이면 둘 다 null. `evlEndDt`는 PASS 경험치 적립 시각과 1초 이내로 같음 | 응답, `point/exp/list` 대조 |
| `searchList.evlDegr` | `1`, `2` | 평가 차수(재평가면 2) | 응답 |
| `mtlEvlTxnDtoByPkList.mtlEvlStusNm` | `00006` "평가완료", "평가요청취소", "평가거절" | 세션 상태. 이름에 "완료" → COMPLETED, "취소"/"거절" → CANCELLED(EV Tracker와 같은 분류) | 응답 |
| Quest Tracker `aggregates[].N/M/E/C` | 미시작/미진행/평가중/완료 | N은 API 값이 아니라 **기록 부재에서 추론** | Quest Tracker `statusLabel` |
| EV Tracker `events[].status` | `COMPLETED`/`CANCELLED`/`REQUESTED`/`IN_PROGRESS` | 평가 이벤트 상태(한글 상태명을 정규화한 값) | EV Tracker |

---

## 5. 레벨과 경험치

### 5.1 레벨은 누적 경험치 임계값으로 오릅니다

특정 과제 완료가 아니라 누적 경험치가 임계값을 넘으면 레벨이 오릅니다(사용자 확인, 2026-07-27). 과제는 순서 없이
자유 선택입니다.

### 5.2 레벨 임계값

| 레벨 | 누적 경험치 | 신뢰도 | 어떻게 알았나 |
|---|---|---|---|
| Lv.4 | 약 6,000~6,500 | unknown | 다른 수강생(당시 Lv.6)에게 전해 들은 값. 검증할 계정 없음 |
| Lv.5 | 8,800 | confirmed_api | 2026-07-30 Lv.4 계정의 `nextLvlRequiredExprc` = 8,800(전언 "약 9,000"을 대체). 이후 실제로 넘겨 2026-08-05 17:21:59 Lv.5 도달(`levelRegDt`) |
| Lv.6 | 11,000 | confirmed_api | Lv.5 계정의 `nextLvlRequiredExprc`. 2026-08-20 00:51:35 Lv.6 도달 |
| Lv.7 | 14,000 | confirmed_api | Lv.6 계정의 `nextLvlRequiredExprc` |
| Lv.8 | 미확인 | — | 2026-10-11 12:54:21 Lv.8 도달(`levelRegDt`, 그때 exp 18,056)했지만 임계값 자체는 Lv.7 계정에서 봤어야 함 |
| Lv.9 | 21,000 | confirmed_api | 2026-10-21 Lv.8 계정의 `nextLvlRequiredExprc` |

`nextLvlRequiredExprc`는 "다음 레벨까지 남은 양"이 아니라 **다음 레벨의 누적 임계값**입니다(Lv.4 계정이 exp 6,540일 때
8,800이 왔음).

### 5.3 경험치 적립 종류 (`point/exp/list`, 2026-10-21 본인 내역)

| `exprcTypeNo` | 설명(`exprcDtlDesc`) | 값 | 본인 건수/합계 |
|---|---|---|---|
| 52 | 단위문제, 과정평가 별 평가결과 PASS 시 평가가이드에 명시된 경험치 기준으로 적립 | 과제별(아래) | 16건 / 16,800 |
| 24 | 평가종료 시 학습자에게 적립 | **5** | 50건 / 250 |
| 23 | (과제명) … 평가요청취소 경험치 적립 | **2** | 3건 / 6 |
| 212 | 선발이관적립 | **1,000** | 1건(2026-05-06, 1기 시작 시점) |
| | **합계** | | **18,056 = 현재 exp** |

"평가종료 시 학습자에게 적립"은 평가를 받든 하든 평가 한 건이 끝날 때마다 붙는 것으로 보입니다(PASS 행과 같은 시각에 짝으로
찍히는 경우와 단독으로 찍히는 경우가 섞여 있음).

### 5.4 미션별 지급 경험치

PASS 적립(type 52) 행의 `regDt`가 평가 기록의 `evlEndDt`와 같은 초(한 건은 1초 차이)로 일치해서, 적립 한 건이 어느 과제인지 정확히 맞출 수 있었습니다.

| 단계 | uqstnNo | XP | 신뢰도 | 이력 |
|---|---|---|---|---|
| 1-1 / 1-2 | 185004 / 185005 | 600 / 600 | confirmed_api | 전언(07-27) → 사용자 확인 → 내역 대조(10-21) |
| 2-1 / 2-2 | 185006 / 185007 | 900 / 300 | confirmed_api | 같음 |
| 3-1 / 3-2 | 185008 / 185009 | 1,200 / 1,200 | confirmed_api | 같음 |
| 4-1 | 185010 | 1,200 | confirmed_api | 전언 1,600 → 사용자 확인으로 1,200 정정(07-27) → 내역 대조 |
| 4-2 | 185011 | 1,600 | confirmed_api | 전언 1,200 → 사용자 확인으로 1,600 정정(08-05). 4-1과 값이 뒤바뀌어 전해졌던 것. 내역의 2026-08-05 17:21:59 1,600 적립이 185011 `evlEndDt` 17:21:58과 1초 차이로 대응 |
| 5-1 | 185012 | 600 | confirmed_api | 전언 → 사용자 확인 → 내역 대조 |
| 5-2 | 185013 | **1,200** | confirmed_api | 08-02 화면·API에서 못 찾음 → 10-21 내역 대조로 확정 |
| 5-3 | 185014 | 1,200 | confirmed_api | 사용자 확인(08-19) → 내역 대조 |
| 6-1 / 6-2 | 185015 / 185016 | 600 / 600 | confirmed_api | 사용자 확인(07-27) → 내역 대조 |
| 텀프로젝트 | 185017 | **1,800** | confirmed_api | 10-21 내역 대조로 확정 |
| 텀프로젝트 고도화 | 185018 | (2,400 예측) | — | 본인 기록 없음 |
| 심화 머신러닝 | 188006 / 188007 | 1,600 / 1,600 | confirmed_api | 10-21 내역 대조 |

**규칙:** 도구학습은 **공식 학습시간(분) × 15(필수), × 20(선택)**입니다. 확인된 도구학습 값이 전부 맞고, 처음 이 규칙을 세울 때
예측했던 5-2 = 1,200과 텀프로젝트 = 1,800이 내역 대조로 그대로 확인됐습니다. 심화는 필수 80분 과제가 1,600이라 × 20입니다(2건뿐이라
심화 전체에 맞는지는 아직 모름).

- 도구학습 필수 미션 10개 합 = 520분 × 15 = 7,800, 텀프로젝트 포함 9,600. 선발이관 1,000을 더하면 10,600으로, 도구학습 필수만
  끝내도 Lv.5(8,800)는 넘고 Lv.6(11,000)엔 조금 모자랍니다(평가 보너스 +5씩은 별도).
- 미션 XP를 직접 돌려주는 API 필드는 없습니다. 과제 마스터나 학습맵(`learningProgress/child/list`)에도 경험치 필드는 없었습니다.

### 5.5 정정 이력

- **레벨 32 사건(2026-07-30):** 처음엔 `instList[0].level`을 레벨로 매핑했는데, 실제 Lv.4 계정에 `32`가 왔습니다.
  화면 LEVEL 배지와 대조해 `point/pnt/total/detail.level`이 진짜 레벨임을 확인하고 교체했습니다.
- **선행조건 그래프 제거(2026-07-28):** 커리큘럼 순번으로 과제 해제 순서를 추정했지만 실제로는 선행조건이 없다는
  사용자 확인으로 `unlocks`/잠김 상태를 삭제했습니다.
- **관심 과제 제거:** 대응하는 API가 없어 필드 자체를 없앴습니다.

---

## 6. 레벨 분포와 과정·기수 (2026-10-21)

### 6.1 집계 방법

`currentSeasonDetail` → `weeklyList` → 길드마다 `guild/{id}/detail`을 돌며 `members[].level`만 셉니다. 응답에 실명·이메일·
프로필 이미지가 함께 오지만 읽지 않고 버립니다. 2026-10-21 시즌 3·10주차, 올인원 길드 4개(guildId 27~30 — 앰버·오션·시에나·오로라),
길드당 약 90명, 총 357명입니다.

과거 관측: 2026-07-28 사용자가 한 길드 상세 화면에서 본 분포(Lv.3 15, Lv.4 3, Lv.5 1, Lv.6 1)가 세션이 없을 때의 폴백
스냅샷입니다.

### 6.2 올인원/네이티브

길드 API는 세션 계정의 기관 길드만 돌려주고 `instCd` 파라미터를 무시합니다. 그래서 과정은 **세션 계정의
`instList[0].instNm`**으로 정합니다("올인원" 포함 → 올인원, "네이티브" 포함 → 네이티브). 올인원 계정 세션으로는 네이티브가
한 명도 보이지 않습니다. 네이티브 분포는 네이티브 계정 세션이 있어야 합니다.

### 6.3 1기/2기 — 1기 = 2026-08-12 Quest Tracker 명단

API에 기수 필드가 없어 외부 스냅샷으로 판정합니다. 아카이브된 `codyssey_Quest_Tracker`의 마지막 `current.json`
(2026-08-12, `meta.membersTotal` 150 = 당시 길드 총원)에는 `mbrId`가 `sha1:` + sha1 앞 8자리로 들어 있습니다. 지금 길드 멤버의
`mbrId`를 같은 방식으로 해시해 명단에 있으면 1기입니다.

교차 검증(각자의 첫 평가 기록 `evlBgngDt`):

| 그룹 | 인원 | 2026-08-13 이전 평가 기록 |
|---|---|---|
| 8월 명단에 있음 | 142 | 113명 있음, 29명 없음 |
| 8월 명단에 없음 | 215 | **0명**. 첫 평가는 2026-09(176명), 2026-10(5명) |

- 명단 밖 215명은 9월부터 평가를 시작했습니다 → 2기는 9월 시작.
- 1기 142명(8월 150명 중 8명 이탈)은 운영 정보 "1기 약 100~150명, 2026년 5월 시작"과 맞습니다.
- 1기는 새로 늘지 않으므로 명단을 다시 갱신할 필요가 없습니다.

앱 구현(`lib/codyssey-client.ts`): 명단을 저장소에 복사하지 않고 공개 URL에서 프로세스당 한 번 받아 메모리에서만
대조합니다. 받지 못하면 기수 구분 없이 합계만 보입니다.

**버린 방법 — 회원번호 대역:** 처음엔 `mbrId`가 `1000327049`와 `1000350034` 사이에서 비어 있는 것을 보고 `1000330000` 미만을
1기로 나눴습니다(1기 203 / 2기 154). 8월 명단과 대조하니 틀렸습니다. 8월 명단 150명은 전부 `1000260000`~`1000279999`에
있었지만 같은 대역에 8월 이후 합류자가 29명 있었고, `1000280000` 이상은 전원 8월 이후 합류자였습니다. `mbrId`는 기수가
아니라 계정 생성 순서라, 2기 지원자가 선발 과정 중 미리 만든 계정이 섞인 것으로 보입니다.

### 6.4 결과

| 레벨 | 1기 | 2기 | 합계 |
|---|---|---|---|
| Lv.1 | 32 | 88 | 120 |
| Lv.2 | 24 | 94 | 118 |
| Lv.3 | 16 | 26 | 42 |
| Lv.4 | 31 | 5 | 36 |
| Lv.5 | 29 | 2 | 31 |
| Lv.6 | 6 | – | 6 |
| Lv.7 | 2 | – | 2 |
| Lv.8 | 1 | – | 1 |
| Lv.11 | 1 | – | 1 |
| **합계** | **142** | **215** | **357** |

- Lv.0은 없습니다. 평가 기록 0건인 사람도 전부 Lv.1이라 Lv.1이 시작 레벨로 보입니다.
- 2기는 약 400명을 뽑았다고 알려졌지만 길드에서 보이는 2기는 215명입니다. 나머지가 길드 미배정인지, 다른 기관 코드인지,
  이탈인지는 이 권한으로 구분할 수 없습니다.

---

## 7. 일회성 분석

### 7.1 올인원 1기 사이렌 (2026-10-21 기준)

공지: 10월 31일까지 AI 도구학습(필수 미션 100% + 텀프로젝트 완료) 미이수 시 사이렌(중도 탈락). 미이수자 중 텀프로젝트 수행
또는 필수 미션 1개 이상 수행자는 12/15까지 유예 신청 가능.

판정(1기 142명 각자의 `searchList`):

- **이수:** 필수 미션 10개와 185017이 모두 `passedYn = "Y"`.
- **유예 자격:** 미이수 중 185017 평가 기록이 1건 이상(상태 무관)이거나 필수 미션 PASS가 1개 이상. "수행"을 "평가 기록 있음/PASS"로
  해석했으므로, 과제는 하고 있지만 아직 평가를 요청하지 않은 사람은 0으로 잡힙니다.
- 검증: 심화(`136002`) 기록이 있는 사람은 전원 이수자였고, 미이수인데 심화 기록이 있는 사람은 0명.

| 구분 | 인원 |
|---|---|
| 1기 전체 | 142 |
| 도구학습 이수 | 23 |
| **사이렌 대상(미이수)** | **119 (83.8%)** |
| └ 유예 자격 있음 | 87 |
| └ 유예 자격 없음(평가 기록 0건) | 32 |

### 7.2 7월 장학금(100만 원) 자격 (2026-08-02)

기준(사용자 제공): 7월 출입 인정시간 합 80시간 이상(하루 최대 12시간만 인정 — Time Manager의 일 상한과 같음) + 평가 2회 이상 + 피평가
2회 이상. 당시 1기 150명을 대상으로 한 번 계산했습니다(출입은 `rest/secom/detail`, 평가는 `searchList` 계열이 원천). **계산 방법의
세부와 결과 숫자는 그 세션 기록이 남아 있지 않아 이 문서에 옮기지 못했습니다.**

---

## 8. 공개 트래커 데이터와 갱신 파이프라인

### 8.1 원천 저장소

| 저장소 | 파일 | 앱이 쓰는 것 | 마지막 갱신 |
|---|---|---|---|
| `codyssey_Quest_Tracker` | `docs/data/current.json` | `assignments[]`(과제 마스터), `aggregates[uqstnNo].ALL`(N/M/E/C, pass/fail, total), 1기 명단 | **2026-08-12** (08-13 `ARCHIVED.md`로 폐기 선언) |
| `codyssey_EV_Tracker` | `docs/data/YYYY-MM.json` | `events[]`: `requestedAt`, `slotDateTime`, `status`, `trackName` | **2026-08-12** (`2026-09.json`·`2026-10.json` 없음) |
| `codyssey_Jail_Tracker` | `dashboard/data/YYYY-MM.json` | 앱은 사용 안 함(조사만) | 2026-08-12 |
| `codyssey_commons` | 로스터 | 앱은 사용 안 함 | 2026-08-03 |
| `Codyssey-time-manager` | — | 인정시간 계산 원칙(일 12시간 상한)만 참고 | 2026-08-18 |

트래커들이 2026-08-12에 멈춰서 2026-10-21까지 **과제 시세·평가 시장·시장 개요는 8/12 데이터에 고정**되어 있었습니다.
예전 `refresh-quests`(매일)는 같은 스냅샷을 다시 넣어 7일 변화율이 0%였고, `refresh-eval`(매주)은 `2026-08.json`만 받았습니다.
DB 이력을 보면 이 GitHub Actions 잡들도 2026-09-28 이후 돌지 않았습니다(저장소에 60일 활동이 없으면 GitHub가 예약 워크플로를
멈춥니다). 2026-10-21에 두 스크립트를 지우고 직접 수집기(8.2절)로 바꿨습니다.

### 8.2 갱신 스크립트와 DB

| 명령 | 주기(Actions) | 하는 일 |
|---|---|---|
| `npm run db:seed` | 수동 | `db/schema.sql` 적용 + `db/seed/*.json`(2026-07-26 스냅샷) 적재 |
| `npm run collect` | 매일 04:00 KST(`.github/workflows/collect.yml`) | 코디세이 API 직접 수집 → `quests` 상태 분포·PASS/FAIL·변화율·트랙 평균 처리시간, `eval_aggregate_*` 재작성. `-- --dry-run`이면 출력만 |

수집기(`scripts/collect-live.mjs`) 순서와 정의:

1. `currentSeasonDetail` → `weeklyList` → 길드마다 `guild/{id}/detail`에서 `mbrId`만 → 2026-10-21 357명(1기+2기).
2. 회원마다 `searchList`(120ms 간격). 과제마다 **가장 최신 행**으로 상태를 정합니다: 행 없음 N(미시작), `00001` M(미진행),
   `00002` E(평가중), `00003` C(완료), 완료 중 `passedYn` Y/N으로 PASS/FAIL. 예전 Quest Tracker 정의와 같지만, 예전 코드는 DESC
   목록에서 마지막(=가장 오래된) 행이 이기는 버그가 있었습니다.
3. `evlEndDt`가 최근 90일 안이거나 아직 없는 평가마다 `mtlEvlTxnDtoByPkList`(2026-10-21 1,162건) → `regDt`가 90일 안인 세션만
   남깁니다(2,379건: 완료 2,372, 취소 6). 같은 세션은 `mtlEvlSn`으로 중복 제거합니다.
4. 수요 = 완료·취소 세션의 `regDt`(요청 시각) 분포, 공급 = 완료 세션의 `mtlEvlBgngDt`(없으면 예약 슬롯) 분포, 트랙 평균 처리시간 =
   완료 세션의 (실제 시작 − 요청) 평균(`lcorsNm` 기준). 예전 EV Tracker와 같은 정의입니다.
5. 열린 요청 수(요청 대기)·진행 수는 상세에 안 나오므로 2)의 M·E 합계로 씁니다(2026-10-21: 168 / 118).
6. 한 트랜잭션으로 DB에 씁니다. 실패하면 DB는 이전 상태 그대로입니다. 전체 약 4분.

전환 시 정리: 예전 1기 150명 기준 완료 수와 비교하면 변화율이 왜곡되므로 2026-10-21에 `quest_completed_history`를 비웠습니다
(그전 행 525개, 2026-08-25~09-28). 그래서 7일간 변화율은 0%입니다. 취소가 2,379건 중 6건으로 적게 잡히는 것은 취소된 세션이 상세
목록에서 대부분 빠지기 때문으로 보입니다(관측).

| 테이블 | 내용 |
|---|---|
| `quests` | 과제별 상태 분포·PASS/FAIL·통과율·재평가율·표본수·변화율·트랙 평균 처리시간 |
| `eval_aggregate_meta` | 집계 출처·시각·이벤트 총수(단일 행) |
| `eval_aggregate_cells` | 요일(0=일)×시간(0~23) 수요·공급 |
| `quest_completed_history` | 과제별 일별 완료 수(변화율 재료) |

배포: Vercel(함수 리전 `sin1`, Neon Postgres 싱가포르와 같은 곳), DB는 Neon 무료 티어. `.github/workflows/db-check.yml`은 매 푸시마다
임시 Postgres에 schema + seed가 유효한지만 검증합니다.

### 8.3 지표 정의

| 지표 | 정의 | 신뢰도 |
|---|---|---|
| 상태 분포 | 수집기 N/M/E/C(미시작/미진행/평가중/완료). N은 기록 부재 추론. 화면 라벨은 미진행/진행중/평가 대기/완료 순서로 N/M/E/C에 대응 | confirmed_api(N 제외) |
| 통과율·재평가율 | pass/(pass+fail), fail/(pass+fail). 표본 0이면 null | confirmed_api |
| 공식 학습시간 | `learningTm`(분) ÷ 60 | confirmed_api |
| 최근 변화율 | 오늘 완료 수 vs 7일 전 완료 수(`quest_completed_history`) | observed |
| 트랙 평균 처리시간 | 같은 트랙의 완료 세션 (실제 시작 − 요청) 평균. 과제가 아니라 **트랙 단위**. 2026-10-21 도구학습 트랙 5.4~9.9h, 텀프로젝트 91h | observed |
| 수요(평가 시장) | 완료·취소된 요청의 **요청 시각** 분포(열린 요청 제외) | observed |
| 공급(평가 시장) | 완료 이벤트의 **실제 처리 시각** 분포. 열린 슬롯 API가 없어 처리량으로 근사 | inferred |
| 병목지수(0~100) | 처리시간(24h에서 포화) 30 + 재평가율 25 + 정체 비율(진행중+평가대기 / 전체) 35 + 표본<10 페널티 10. 처리시간 없으면 15점 | observed / 표본<10이면 inferred |
| 추천 경로(`/me`) | 남은 과제에 대한 휴리스틱 5종(fastest/safest/low_wait/efficient/balanced). ML 아님 | — |

타임스탬프는 이미 KST 벽시계 값이라 문자열에서 직접 날짜·시각을 뽑아 요일을 계산합니다(시스템 타임존 비의존).

---

## 9. 개인정보 원칙

[docs/privacy-threat-model.md](docs/privacy-threat-model.md)를 따릅니다. 실제로 지킨 것:

- 길드 상세의 실명·이메일·프로필 이미지는 읽지 않고 `mbrId`/`level`만 씁니다. `mbrId`도 기수 판정 후 버립니다.
- 평가 이벤트의 평가자·피평가자 실명은 집계 단계에서 버리고 수치만 DB에 넣습니다.
- 매일 수집기는 길드 상세·평가 상세 응답의 실명·mbrId·점수·피드백을 읽지 않고, 회원별 행 없이 과제·시간대 단위 집계만 DB에 씁니다.
- 개인별 분석(7절)은 메모리에서 집계만 하고 개인별 행을 출력하거나 저장하지 않았습니다.
- 2026-10-21 시도했다가 하지 않은 것: 이름으로 사용자 검색(길드 밖 인원 찾기), 1기 명단 해시를 저장소에 복사(해시가 8자리라 쉽게
  역산됨 — 대신 런타임 조회).
- 쓰기 API는 한 번도 호출하지 않았습니다.

---

## 10. 재현 명령

```bash
# 0) 세션 유효성
curl -s -H "Cookie: $S" -w "\n%{http_code}\n" https://api.usr.codyssey.kr/guild/season/currentSeasonDetail

# 1) 본인 레벨/경험치/다음 레벨 임계값
curl -s -H "Cookie: $S" https://api.usr.codyssey.kr/point/pnt/total/detail

# 2) 본인 과정(instCd/instNm)
curl -s -H "Cookie: $S" https://api.usr.codyssey.kr/rest/user/info/detail

# 3) 시즌 → 길드 목록 → 길드 멤버(레벨)
curl -s -H "Cookie: $S" "https://api.usr.codyssey.kr/guild/ranking/weeklyList?guildSeasonId=16&weekNo=10"
curl -s -H "Cookie: $S" "https://api.usr.codyssey.kr/guild/29/detail?guildSeasonId=16&weekNo=10"

# 4) 한 회원의 평가 기록(POST — XSRF 헤더 필요)
X=$(echo "$S" | sed -n 's/.*XSRF-TOKEN=\([^;]*\).*/\1/p')
curl -s -X POST -H "Cookie: $S" -H "X-XSRF-TOKEN: $X" -H "X-Requested-With: XMLHttpRequest" \
  -d "mbrId=<mbrId>&instCd=00021&page=1&pagePerRows=200&orderBy=DESC" \
  https://api.usr.codyssey.kr/ev/request/mbrSearch/searchList
```

```bash
# 5) 본인 경험치 적립 내역(POST, JSON 본문)
curl -s -X POST -H "Cookie: $S" -H "X-XSRF-TOKEN: $X" -H "X-Requested-With: XMLHttpRequest" \
  -H "Content-Type: application/json" -d '{"page":1,"pagePerRows":500,"mbrId":"<본인 mbrId>","instCd":"00021"}' \
  https://api.usr.codyssey.kr/point/exp/list
```

전원 집계(6·7절)는 3) 이후 멤버마다 4)를 120ms 간격으로 호출해(357명 약 2분) 메모리에서 세었습니다.

---

## 11. 아직 모르는 것

- Lv.4·Lv.8 임계값, 185018 경험치(규칙상 2,400 예측), 심화 과제 전체의 경험치 규칙
- Level 5 시험 응시 조건, 시험 합격 기준
- `instList[0].level`("32", "91")의 의미
- 네이티브 과정 분포(네이티브 세션 필요), 길드 밖 2기 인원
- 열린 평가 슬롯(공급의 실제 값) — 수집 경로 없음
