-- =====================================================================
-- 3. Row Level Security: кто какие строки видит и меняет
-- =====================================================================
-- Для роли anon нет ни одной политики: без входа не видно ничего.
-- (select auth.uid()) в скобках — рекомендация Supabase: вычисляется
-- один раз на запрос, а не для каждой строки.

alter table public.profiles     enable row level security;
alter table public.objects      enable row level security;
alter table public.tasks        enable row level security;
alter table public.task_history enable row level security;

-- ---------- profiles ----------
-- Изменять профили (и роль) через API нельзя никому: политик на запись нет.
create policy profiles_select on public.profiles
  for select to authenticated
  using (public.can_see_profile(id));

-- ---------- objects ----------
-- Постановщик видит всё; исполнитель — объекты, где у него есть задачи.
create policy objects_select on public.objects
  for select to authenticated
  using (
    public.is_manager()
    or exists (
      select 1 from public.tasks t
      where t.object_id = objects.id
        and t.assignee_id = (select auth.uid())
    )
  );

create policy objects_insert on public.objects
  for insert to authenticated
  with check (public.is_manager());

create policy objects_update on public.objects
  for update to authenticated
  using (public.is_manager())
  with check (public.is_manager());

create policy objects_delete on public.objects
  for delete to authenticated
  using (public.is_manager());

-- ---------- tasks ----------
-- Исполнитель видит только задачи, где он назначен.
create policy tasks_select on public.tasks
  for select to authenticated
  using (
    public.is_manager()
    or assignee_id = (select auth.uid())
  );

create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (public.is_manager());

-- Правка текста и объекта — только постановщик.
-- Статус и исполнитель — только через change_task_status / reassign_task.
create policy tasks_update on public.tasks
  for update to authenticated
  using (public.is_manager())
  with check (public.is_manager());

create policy tasks_delete on public.tasks
  for delete to authenticated
  using (public.is_manager());

-- ---------- task_history ----------
-- Видна тем, кто видит задачу (RLS на tasks срабатывает в подзапросе).
-- Политик на INSERT/UPDATE/DELETE нет, права на запись отозваны.
create policy task_history_select on public.task_history
  for select to authenticated
  using (
    exists (select 1 from public.tasks t where t.id = task_history.task_id)
  );
