-- =====================================================================
-- Тестовые данные. Выполнить в Supabase → SQL Editor после миграций.
--
-- Перед запуском создайте в Authentication → Users трёх пользователей
-- (Add user → Create new user, Auto Confirm User):
--   manager@test.ru  — постановщик
--   worker1@test.ru  — исполнитель 1
--   worker2@test.ru  — исполнитель 2
--
-- Скрипт назначает роли и создаёт 3 объекта и 9 задач во всех статусах.
-- Все действия выполняются через те же функции, что и в приложении,
-- от имени нужного пользователя, поэтому история получается настоящей.
-- =====================================================================

-- Действовать от имени пользователя: auth.uid() читает sub из этих claims
create or replace function pg_temp.act_as(u uuid)
returns void language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', u, 'role', 'authenticated')::text, true);
$$;

do $$
declare
  m  uuid;  w1 uuid;  w2 uuid;
  o1 uuid;  o2 uuid;  o3 uuid;
  t  uuid;
begin
  select id into m  from auth.users where email = 'manager@test.ru';
  select id into w1 from auth.users where email = 'worker1@test.ru';
  select id into w2 from auth.users where email = 'worker2@test.ru';

  if m is null or w1 is null or w2 is null then
    raise exception 'Сначала создайте пользователей manager@test.ru, worker1@test.ru, worker2@test.ru в Authentication → Users';
  end if;

  -- Роли и имена
  insert into public.profiles (id, full_name, role) values
    (m,  'Сергей Иванов (постановщик)', 'manager'),
    (w1, 'Алексей Петров',              'executor'),
    (w2, 'Дмитрий Смирнов',             'executor')
  on conflict (id) do update
    set full_name = excluded.full_name, role = excluded.role;

  if exists (select 1 from public.objects) then
    raise notice 'Объекты уже есть — роли обновлены, данные не добавляю';
    return;
  end if;

  -- ---------- Объекты (создаёт постановщик) ----------
  perform pg_temp.act_as(m);

  insert into public.objects (name, address)
  values ('ЖК «Северный», корпус 2', 'Москва, ул. Полярная, 15')
  returning id into o1;

  insert into public.objects (name, address)
  values ('Коттедж в Подрезково', 'Московская обл., Химки, ул. Лесная, 8')
  returning id into o2;

  insert into public.objects (name, address)
  values ('Офис на Тверской, ремонт', 'Москва, ул. Тверская, 22, офис 310')
  returning id into o3;

  -- ---------- ЖК «Северный» ----------
  -- 1. Принята
  perform pg_temp.act_as(m);
  insert into public.tasks (object_id, title, description, assignee_id)
  values (o1, 'Залить фундамент секции Б',
          'Бетон М300, армирование по проекту КЖ-2. Перед заливкой фотоотчёт по арматуре.', w1)
  returning id into t;
  perform pg_temp.act_as(w1);
  perform public.change_task_status(t, 'in_progress');
  perform public.change_task_status(t, 'review', 'Залито, фото арматуры в чате');
  perform pg_temp.act_as(m);
  perform public.change_task_status(t, 'accepted', 'Принято, замечаний нет');

  -- 2. В работе
  perform pg_temp.act_as(m);
  insert into public.tasks (object_id, title, description, assignee_id)
  values (o1, 'Монтаж опалубки 3 этажа', 'Щитовая опалубка, перекрытие и колонны по осям 1–6.', w1)
  returning id into t;
  perform pg_temp.act_as(w1);
  perform public.change_task_status(t, 'in_progress');

  -- 3. На проверке
  perform pg_temp.act_as(m);
  insert into public.tasks (object_id, title, description, assignee_id)
  values (o1, 'Гидроизоляция подвала', 'Обмазочная гидроизоляция в два слоя, стены и пол подвала.', w2)
  returning id into t;
  perform pg_temp.act_as(w2);
  perform public.change_task_status(t, 'in_progress');
  perform public.change_task_status(t, 'review', 'Готово, можно смотреть');

  -- 4. На доработке
  perform pg_temp.act_as(m);
  insert into public.tasks (object_id, title, description, assignee_id)
  values (o1, 'Кладка перегородок 2 этажа', 'Газобетон 100 мм, по плану этажа.', w2)
  returning id into t;
  perform pg_temp.act_as(w2);
  perform public.change_task_status(t, 'in_progress');
  perform public.change_task_status(t, 'review');
  perform pg_temp.act_as(m);
  perform public.change_task_status(t, 'rework', 'Толщина шва больше 5 мм, переложить у оси 4');

  -- ---------- Коттедж в Подрезково ----------
  -- 5. Новая
  perform pg_temp.act_as(m);
  insert into public.tasks (object_id, title, description, assignee_id)
  values (o2, 'Установить окна', 'ПВХ, 7 штук, монтаж по ГОСТ с пароизоляционной лентой.', w1);

  -- 6. На проверке после одного возврата
  perform pg_temp.act_as(m);
  insert into public.tasks (object_id, title, description, assignee_id)
  values (o2, 'Утепление кровли', 'Минвата 200 мм, пароизоляция с проклейкой стыков.', w2)
  returning id into t;
  perform pg_temp.act_as(w2);
  perform public.change_task_status(t, 'in_progress');
  perform public.change_task_status(t, 'review');
  perform pg_temp.act_as(m);
  perform public.change_task_status(t, 'rework', 'Стыки пароизоляции не проклеены');
  perform pg_temp.act_as(w2);
  perform public.change_task_status(t, 'in_progress');
  perform public.change_task_status(t, 'review', 'Стыки проклеены');

  -- 7. Отменена
  perform pg_temp.act_as(m);
  insert into public.tasks (object_id, title, description, assignee_id)
  values (o2, 'Демонтаж старой веранды', 'Разобрать веранду, вывезти мусор.', w1)
  returning id into t;
  perform public.change_task_status(t, 'cancelled', 'Заказчик решил сохранить веранду');

  -- ---------- Офис на Тверской (только у второго исполнителя) ----------
  -- 8. Новая
  perform pg_temp.act_as(m);
  insert into public.tasks (object_id, title, description, assignee_id)
  values (o3, 'Электромонтаж', 'Розеточные группы и освещение по проекту ЭМ.', w2);

  -- 9. Смена исполнителя: был в работе у первого, передан второму
  perform pg_temp.act_as(m);
  insert into public.tasks (object_id, title, description, assignee_id)
  values (o3, 'Покраска стен', 'Два слоя, цвет по RAL 9010.', w1)
  returning id into t;
  perform pg_temp.act_as(w1);
  perform public.change_task_status(t, 'in_progress');
  perform pg_temp.act_as(m);
  perform public.reassign_task(t, w2, 'Алексей переведён на другой объект');

  -- Разносим историю по времени, чтобы она выглядела как реальная работа:
  -- шаг 3 часа между событиями, последнее событие — сейчас.
  update public.task_history
     set created_at = now() - ((select max(id) from public.task_history) - id) * interval '3 hours';

  perform set_config('app.via_rpc', 'on', true);
  update public.tasks t
     set created_at = (select min(h.created_at) from public.task_history h where h.task_id = t.id);
  update public.objects o
     set created_at = (select min(t.created_at) from public.tasks t where t.object_id = o.id) - interval '1 hour';
  perform set_config('app.via_rpc', '', true);

  perform set_config('request.jwt.claims', '', true);
  raise notice 'Готово: 3 объекта, 9 задач';
end;
$$;
