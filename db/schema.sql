-- Codyssey Exchange schema. One database, two concerns:
--   quests               — 과제 카탈로그 스냅샷 (구 real-quests.ts)
--   eval_aggregate_meta   — 평가 시장 집계 메타 (구 real-eval-aggregate.ts 상단)
--   eval_aggregate_cells  — 시간대x요일 수요/공급 셀
-- 애플리케이션은 이 테이블을 읽기 전용으로 조회한다. 쓰기는 scripts/seed-db.mjs 뿐이다.

create table if not exists quests (
  id text primary key,
  name text not null,
  track text not null,
  course text not null,
  required boolean not null,
  official_learning_hours numeric not null,
  not_started int not null,
  in_progress int not null,
  eval_waiting int not null,
  completed int not null,
  pass_count int not null,
  fail_count int not null,
  pass_rate numeric,
  retry_rate numeric,
  sample_size int not null,
  recent_change_pct numeric not null,
  avg_wait_hours numeric,
  data_generated_at timestamptz not null
);

create table if not exists eval_aggregate_meta (
  id boolean primary key default true check (id), -- 단일 행만 허용
  source text not null,
  generated_at timestamptz not null,
  total_events int not null,
  total_completed int not null,
  total_cancelled int not null,
  total_requested int not null,
  total_in_progress int not null,
  day_labels text[] not null
);

create table if not exists eval_aggregate_cells (
  day_of_week int not null check (day_of_week between 0 and 6),
  hour int not null check (hour between 0 and 23),
  demand int not null,
  supply int not null,
  primary key (day_of_week, hour)
);

-- 과제별 완료건수 일별 스냅샷 이력 — recent_change_pct를 7일 롤링 윈도로 계산하기 위한 재료.
-- scripts/refresh-quests.mjs가 매일 한 행씩 쌓고, 35일보다 오래된 행은 지운다.
create table if not exists quest_completed_history (
  quest_id text not null,
  captured_at timestamptz not null,
  completed int not null,
  primary key (quest_id, captured_at)
);
