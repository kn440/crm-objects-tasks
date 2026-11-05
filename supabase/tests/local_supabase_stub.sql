-- Только для локальной проверки миграций на чистом Postgres без Supabase.
-- В Supabase это всё уже есть — там этот файл НЕ выполняется.
-- Повторяет то, на что опираются миграции: роли anon/authenticated,
-- схему auth, таблицу auth.users, функцию auth.uid() и права по умолчанию.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
grant usage on schema auth to anon, authenticated;

create table auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text unique,
  raw_user_meta_data jsonb default '{}'::jsonb
);

-- Так же, как в Supabase
create or replace function auth.uid() returns uuid
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
grant execute on function auth.uid() to anon, authenticated;

-- Supabase по умолчанию раздаёт anon и authenticated все права на новые
-- объекты в public. Повторяем, чтобы проверить, что миграции их забирают.
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables    to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;

insert into auth.users (email) values
  ('manager@test.ru'), ('worker1@test.ru'), ('worker2@test.ru');
