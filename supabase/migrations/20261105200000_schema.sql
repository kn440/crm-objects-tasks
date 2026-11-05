-- =====================================================================
-- 1. Схема: типы, таблицы, индексы, права на таблицы
-- =====================================================================

-- Роли пользователей и статусы задач
create type public.app_role as enum ('manager', 'executor');

create type public.task_status as enum (
  'new',          -- Новая
  'in_progress',  -- В работе
  'review',       -- На проверке
  'rework',       -- На доработке
  'accepted',     -- Принята
  'cancelled'     -- Отменена
);

-- Профиль пользователя. Роль хранится здесь, а не в user_metadata:
-- user_metadata пользователь может изменить сам через auth.updateUser().
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null check (length(trim(full_name)) > 0),
  role       public.app_role not null default 'executor',
  created_at timestamptz not null default now()
);

-- Объект (стройка)
create table public.objects (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) > 0),
  address    text not null check (length(trim(address)) > 0),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Задача
create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  -- on delete restrict: объект с задачами удалить нельзя
  object_id   uuid not null references public.objects (id) on delete restrict,
  title       text not null check (length(trim(title)) > 0),
  description text not null default '',
  assignee_id uuid not null references public.profiles (id) on delete restrict,
  status      public.task_status not null default 'new',
  author_id   uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index tasks_object_id_idx   on public.tasks (object_id);
create index tasks_assignee_id_idx on public.tasks (assignee_id);

-- История задачи: смена статуса и смена исполнителя.
-- Пишется только функциями и триггерами базы, клиент может лишь читать.
create table public.task_history (
  id              bigint generated always as identity primary key,
  task_id         uuid not null references public.tasks (id) on delete cascade,
  actor_id        uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  from_status     public.task_status,            -- null у записи о создании
  to_status       public.task_status not null,
  comment         text,
  old_assignee_id uuid references public.profiles (id) on delete set null,
  new_assignee_id uuid references public.profiles (id) on delete set null
);

create index task_history_task_id_idx on public.task_history (task_id, created_at);

-- ---------------------------------------------------------------------
-- Права на таблицы.
-- Supabase по умолчанию выдаёт anon и authenticated все права на новые
-- таблицы. Забираем всё и выдаём только нужное, вплоть до колонок.
-- ---------------------------------------------------------------------
revoke all on public.profiles, public.objects, public.tasks, public.task_history
  from anon, authenticated;

-- profiles: только чтение (какие строки — решает RLS)
grant select on public.profiles to authenticated;

-- objects: чтение, создание и правка названия/адреса, удаление
grant select, delete on public.objects to authenticated;
grant insert (name, address) on public.objects to authenticated;
grant update (name, address) on public.objects to authenticated;

-- tasks: статус, автор и даты клиент не может ни задать, ни изменить.
-- Статус и исполнитель меняются только через функции change_task_status
-- и reassign_task.
grant select, delete on public.tasks to authenticated;
grant insert (object_id, title, description, assignee_id) on public.tasks to authenticated;
grant update (object_id, title, description) on public.tasks to authenticated;

-- task_history: только чтение. INSERT/UPDATE/DELETE не выдаются никому.
grant select on public.task_history to authenticated;
