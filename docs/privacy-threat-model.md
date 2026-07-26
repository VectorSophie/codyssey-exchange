# 개인정보 위협 모델

[[existing-trackers]] 조사에서 확인된 실제 위험(EV Tracker의 실명 관계 데이터 공개, Jail Tracker의 약한 해시 익명화)을 반면교사로 삼아 Codyssey Exchange의 경계를 정의한다.

## 데이터 계층과 공개 여부

| 계층 | 경로 | 공개 여부 | 포함 가능 데이터 |
|---|---|---|---|
| raw | `data/private/raw/` | 비공개 (.gitignore) | API 원본 응답, 세션 쿠키 |
| normalized | `data/private/normalized/` | 비공개 | mbrId 포함 정규화 엔티티 |
| aggregate | `data/public/aggregate/` | 공개 가능 | 익명 ID, 집계 수치, 분포 |
| fixtures/mock | `data/fixtures/`, `data/mock/` | 공개(리포지토리에 커밋) | 가상 인물의 한국어 mock data |

## 공개 저장소에 절대 커밋하지 않는 것

- 실제 세션 토큰, 쿠키, 비밀번호, `.env` 실값
- 실명(mbrNm) — 공개 화면은 익명 ID(`anon_xxxxx`, 배포별 랜덤 솔트 해시)만 사용
- 평가 코멘트/피드백 원문
- 프로필 이미지 파일명 또는 URL
- 초 단위 정밀 출입 시각 — 공개 집계는 시간대(hour) 단위로 버킷화

## Jail Tracker/EV Tracker 사례에서 배운 구체적 규칙

1. **해시 솔트는 배포별로 무작위 생성**하고 `private/`에만 저장한다. 소스코드에 하드코딩된 고정 문자열 솔트(`'jail:' + mbrId`처럼)를 사용하지 않는다 — 역산 가능하기 때문.
2. **평가자-피평가자 관계는 공개 화면에 실명으로 노출하지 않는다.** 로그인한 사용자 본인의 데이터만 본인에게 상세히 보여주고, 커뮤니티/랭킹 화면은 집계 또는 익명화한다.
3. **실시간 재실 여부("지금 누가 있는가") 같은 감시성 데이터는 만들지 않는다.** Jail Tracker의 `currentlyInside` 같은 기능은 채택하지 않는다.
4. GitHub Pages/공개 배포 파이프라인은 `data/public/`만 배포 대상으로 삼고, private 디렉터리가 실수로 배포되지 않도록 빌드 스크립트에서 명시적으로 검증한다.

## 사용자가 직접 해야 하는 일 (앱이 대신할 수 없는 것)

- 로그인/브라우저 인증, Codyssey 세션 제공
- 비공개 저장소 접근 권한 부여

## 알려진 한계

- mbrId 자체가 Codyssey 서버 발급 값이므로, Codyssey Exchange의 익명화는 "우리 공개 산출물 안에서" 실명을 감추는 것이지 Codyssey 플랫폼 자체의 익명성을 보장하지 않는다.
- 동시 진행 과제가 있을 때 학습시간을 특정 과제에 귀속시키는 것은 본질적으로 불확실하다 — 이는 개인정보 문제는 아니지만 [[metric-catalog]]에서 반드시 불확실성으로 표시한다.
