create table if not exists app_work_reports (
  id text primary key,
  from_username text not null,
  to_username text not null,
  board_id text,
  board_title text,
  card_id text,
  card_title text,
  body text not null default '',
  file_id text,
  filename text,
  parent_id text,
  created_at text not null,
  read_at text
);
create index if not exists app_work_reports_to_idx on app_work_reports (to_username, created_at desc);
create index if not exists app_work_reports_from_idx on app_work_reports (from_username, created_at desc);
create index if not exists app_work_reports_card_idx on app_work_reports (card_id);
