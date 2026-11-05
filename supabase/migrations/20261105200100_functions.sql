-- =====================================================================
-- 2. Функции, триггеры и действия (RPC)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Вспомогательные функции для политик RLS.
-- security definer: читают profiles в обход RLS, иначе политика на
-- profiles, которая проверяет роль через profiles, уйдёт в рекурсию.
-- ---------------------------------------------------------------------
create or replace function public.my_role()
returns public.app_role
language sql stable security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_manager()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'manager' from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Чей профиль (имя) может видеть текущий пользователь:
-- постановщик — всех; исполнитель — себя и людей из своих задач
-- (авторов и участников истории). Почта в profiles не хранится.
create or replace function public.can_see_profile(p_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select p_id = auth.uid()
      or public.is_manager()
      or exists (
           select 1 from public.tasks t
           where t.assignee_id = auth.uid() and t.author_id = p_id
         )
      or exists (
           select 1
           from public.task_history h
           join public.tasks t on t.id = h.task_id
           where t.assignee_id = auth.uid()
             and p_id in (h.actor_id, h.old_assignee_id, h.new_assignee_id)
         );
$$;

-- Человекочитаемое название статуса (для текстов ошибок)
create or replace function public.status_label(s public.task_status)
returns text
language sql immutable
as $$
  select case s
    when 'new'         then 'Новая'
    when 'in_progress' then 'В работе'
    when 'review'      then 'На проверке'
    when 'rework'      then 'На доработке'
    when 'accepted'    then 'Принята'
    when 'cancelled'   then 'Отменена'
  end;
$$;

-- ---------------------------------------------------------------------
-- Матрица переходов статусов. Единственный источник правды в базе.
-- Та же матрица продублирована во фронте (src/domain/transitions.ts)
-- только для показа кнопок.
-- ---------------------------------------------------------------------
create or replace function public.transition_allowed(
  p_from        public.task_status,
  p_to          public.task_status,
  p_role        public.app_role,
  p_is_assignee boolean
)
returns boolean
language sql immutable
as $$
  select case
    -- назначенный исполнитель
    when p_role = 'executor' and p_is_assignee then
         (p_from = 'new'         and p_to = 'in_progress')
      or (p_from = 'in_progress' and p_to = 'review')
      or (p_from = 'rework'      and p_to = 'in_progress')
    -- постановщик
    when p_role = 'manager' then
         (p_from = 'review'   and p_to = 'accepted')
      or (p_from = 'review'   and p_to = 'rework')
      or (p_from = 'accepted' and p_to = 'rework')                 -- обнаружен брак
      or (p_to = 'cancelled'
          and p_from in ('new', 'in_progress', 'review', 'rework')) -- отмена
    else false
  end;
$$;

-- Для каких переходов комментарий обязателен
create or replace function public.comment_required(p_to public.task_status)
returns boolean
language sql immutable
as $$
  select p_to in ('rework', 'cancelled');
$$;

-- ---------------------------------------------------------------------
-- Триггеры на tasks
-- ---------------------------------------------------------------------

-- Создание: статус, автор и даты ставит база, а не клиент.
create or replace function public.tasks_before_insert()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  new.status     := 'new';
  new.author_id  := coalesce(auth.uid(), new.author_id);  -- в SQL Editor auth.uid() пустой
  new.created_at := now();
  new.updated_at := now();

  if new.author_id is null then
    raise exception 'Не удалось определить автора задачи' using errcode = '42501';
  end if;

  if not exists (select 1 from profiles where id = new.assignee_id and role = 'executor') then
    raise exception 'Исполнителем можно назначить только пользователя с ролью «Исполнитель»'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger tasks_before_insert
  before insert on public.tasks
  for each row execute function public.tasks_before_insert();

-- Первая запись истории: «— → Новая»
create or replace function public.tasks_after_insert()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into task_history (task_id, actor_id, from_status, to_status, new_assignee_id)
  values (new.id, new.author_id, null, 'new', new.assignee_id);
  return new;
end;
$$;

create trigger tasks_after_insert
  after insert on public.tasks
  for each row execute function public.tasks_after_insert();

-- Изменение: правила редактирования.
-- Второй рубеж защиты: даже если права на колонки однажды выдадут шире,
-- статус и исполнитель не изменятся мимо функций change_task_status /
-- reassign_task (они выставляют флаг app.via_rpc на время транзакции).
create or replace function public.tasks_before_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.status      is distinct from old.status
      or new.assignee_id is distinct from old.assignee_id
      or new.author_id   is distinct from old.author_id
      or new.created_at  is distinct from old.created_at)
     and coalesce(current_setting('app.via_rpc', true), '') <> 'on'
  then
    raise exception 'Статус и исполнитель меняются только через действия с задачей'
      using errcode = '42501';
  end if;

  if new.title       is distinct from old.title
     or new.description is distinct from old.description
     or new.object_id   is distinct from old.object_id
  then
    if old.status in ('accepted', 'cancelled') then
      raise exception 'Задачу в статусе «%» нельзя редактировать', status_label(old.status)
        using errcode = 'P0001';
    end if;
    if new.object_id is distinct from old.object_id and old.status <> 'new' then
      raise exception 'Объект можно сменить только у задачи в статусе «Новая»'
        using errcode = 'P0001';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger tasks_before_update
  before update on public.tasks
  for each row execute function public.tasks_before_update();

-- Удаление: только пока по задаче не начиналась работа.
-- Дальше задачу можно только отменить, чтобы сохранить историю.
create or replace function public.tasks_before_delete()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if old.status <> 'new'
     or exists (select 1 from task_history
                where task_id = old.id and to_status = 'in_progress')
  then
    raise exception 'Удалить можно только новую задачу, которую ещё не брали в работу. Используйте отмену.'
      using errcode = 'P0001';
  end if;
  return old;
end;
$$;

create trigger tasks_before_delete
  before delete on public.tasks
  for each row execute function public.tasks_before_delete();

-- ---------------------------------------------------------------------
-- Триггеры на objects
-- ---------------------------------------------------------------------
create or replace function public.objects_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.created_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger objects_before_write
  before insert or update on public.objects
  for each row execute function public.objects_before_write();

-- Понятная ошибка вместо нарушения внешнего ключа
create or replace function public.objects_before_delete()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if exists (select 1 from tasks where object_id = old.id) then
    raise exception 'В объекте есть задачи. Удалить можно только пустой объект.'
      using errcode = 'P0001';
  end if;
  return old;
end;
$$;

create trigger objects_before_delete
  before delete on public.objects
  for each row execute function public.objects_before_delete();

-- ---------------------------------------------------------------------
-- Профиль для новых пользователей Auth (по умолчанию — исполнитель).
-- Роль постановщика назначается вручную в базе.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into profiles (id, full_name, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    'executor'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Действие: смена статуса. Единственный способ изменить статус.
-- ---------------------------------------------------------------------
create or replace function public.change_task_status(
  p_task_id    uuid,
  p_new_status public.task_status,
  p_comment    text default null
)
returns public.tasks
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_role    app_role;
  v_task    tasks;
  v_from    task_status;
  v_comment text := nullif(trim(coalesce(p_comment, '')), '');
begin
  if v_uid is null then
    raise exception 'Требуется вход' using errcode = '42501';
  end if;

  select role into v_role from profiles where id = v_uid;
  if v_role is null then
    raise exception 'Профиль пользователя не найден' using errcode = '42501';
  end if;

  -- Блокируем строку: два одновременных действия не перезапишут друг друга,
  -- второе увидит уже новый статус и получит отказ.
  select * into v_task from tasks where id = p_task_id for update;

  -- Чужую задачу исполнитель не видит: отвечаем так же, как на несуществующую
  if not found or (v_role = 'executor' and v_task.assignee_id <> v_uid) then
    raise exception 'Задача не найдена' using errcode = 'P0002';
  end if;

  v_from := v_task.status;

  if not transition_allowed(v_from, p_new_status, v_role, v_task.assignee_id = v_uid) then
    raise exception 'Переход «%» → «%» недоступен', status_label(v_from), status_label(p_new_status)
      using errcode = 'P0001';
  end if;

  if comment_required(p_new_status) and v_comment is null then
    raise exception 'Для перехода в «%» нужен комментарий', status_label(p_new_status)
      using errcode = 'P0001';
  end if;

  perform set_config('app.via_rpc', 'on', true);
  update tasks set status = p_new_status where id = p_task_id
  returning * into v_task;
  perform set_config('app.via_rpc', '', true);

  insert into task_history (task_id, actor_id, from_status, to_status, comment)
  values (p_task_id, v_uid, v_from, p_new_status, v_comment);

  return v_task;
end;
$$;

-- ---------------------------------------------------------------------
-- Действие: смена исполнителя. Задача возвращается в «Новая»,
-- в историю пишется «Исполнитель изменён: А → Б».
-- ---------------------------------------------------------------------
create or replace function public.reassign_task(
  p_task_id     uuid,
  p_assignee_id uuid,
  p_comment     text default null
)
returns public.tasks
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_task     tasks;
  v_from     task_status;
  v_old      uuid;
  v_old_name text;
  v_new_name text;
  v_comment  text := nullif(trim(coalesce(p_comment, '')), '');
begin
  if v_uid is null or not is_manager() then
    raise exception 'Менять исполнителя может только постановщик' using errcode = '42501';
  end if;

  select * into v_task from tasks where id = p_task_id for update;
  if not found then
    raise exception 'Задача не найдена' using errcode = 'P0002';
  end if;

  if v_task.status in ('accepted', 'cancelled') then
    raise exception 'У задачи в статусе «%» нельзя сменить исполнителя', status_label(v_task.status)
      using errcode = 'P0001';
  end if;

  if p_assignee_id = v_task.assignee_id then
    raise exception 'Этот исполнитель уже назначен' using errcode = 'P0001';
  end if;

  select full_name into v_new_name from profiles where id = p_assignee_id and role = 'executor';
  if v_new_name is null then
    raise exception 'Исполнитель не найден' using errcode = 'P0001';
  end if;
  select full_name into v_old_name from profiles where id = v_task.assignee_id;

  v_from := v_task.status;
  v_old  := v_task.assignee_id;

  perform set_config('app.via_rpc', 'on', true);
  update tasks set assignee_id = p_assignee_id, status = 'new' where id = p_task_id
  returning * into v_task;
  perform set_config('app.via_rpc', '', true);

  insert into task_history (task_id, actor_id, from_status, to_status, comment,
                            old_assignee_id, new_assignee_id)
  values (p_task_id, v_uid, v_from, 'new',
          format('Исполнитель изменён: %s → %s', v_old_name, v_new_name)
            || coalesce('. ' || v_comment, ''),
          v_old, p_assignee_id);

  return v_task;
end;
$$;

-- ---------------------------------------------------------------------
-- Кто может вызывать функции.
-- Supabase по умолчанию разрешает anon вызывать всё в public — забираем.
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;

grant execute on function
  public.my_role(),
  public.is_manager(),
  public.can_see_profile(uuid),
  public.status_label(public.task_status),
  public.transition_allowed(public.task_status, public.task_status, public.app_role, boolean),
  public.comment_required(public.task_status),
  public.change_task_status(uuid, public.task_status, text),
  public.reassign_task(uuid, uuid, text)
to authenticated;
