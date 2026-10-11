-- In-app notifications
create table if not exists app_notifications (
  id text primary key,
  username text not null,
  kind text not null,
  title text not null,
  body text not null default '',
  href text,
  read_at text,
  created_at text not null
);
create index if not exists app_notifications_user_idx on app_notifications (username, created_at desc);

-- Chat/card file blobs stored separately from message body (max ~5MB app-enforced)
create table if not exists app_files (
  id text primary key,
  filename text not null,
  mime text not null,
  size_bytes int not null,
  data text not null,
  uploaded_by text not null,
  created_at text not null
);

-- Optional PIN 2FA (hashed like passwords: scrypt$salt$hash or plain during migrate)
alter table login_users add column if not exists pin_hash text;
alter table login_users add column if not exists pin_enabled boolean not null default false;
