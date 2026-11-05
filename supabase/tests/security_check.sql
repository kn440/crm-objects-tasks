-- =====================================================================
-- Проверка защиты. Запускать в Supabase → SQL Editor после seed.sql.
-- Ничего не меняет: каждая попытка выполняется и откатывается.
--
-- Каждая строка — попытка от имени конкретного пользователя (или без
-- входа) сделать что-то напрямую в базе, в обход интерфейса.
-- Ожидания:
--   blocked — ошибка доступа или 0 строк (данные не видны / не изменены)
--   error   — база отклонила действие с ошибкой
--   allowed — законное действие проходит (контрольные проверки)
--   rows:N  — видно ровно N строк
-- В конце таблица: колонка passed должна быть true во всех строках.
-- =====================================================================

create or replace function pg_temp.try_as(p_user uuid, p_sql text,
                                          out ok boolean, out n bigint, out err text)
language plpgsql as $$
begin
  begin
    perform set_config('request.jwt.claims',
      case when p_user is null then ''
           else json_build_object('sub', p_user, 'role', 'authenticated')::text end, true);
    perform set_config('role', case when p_user is null then 'anon' else 'authenticated' end, true);
    if p_sql ilike 'with %' then
      execute p_sql into n;  -- запрос сам возвращает число строк
    else
      execute 'with q as (' || p_sql || ') select count(*) from q' into n;
    end if;
    -- откатываем всё, что сделала попытка, сохраняя число строк
    raise exception using errcode = 'P9999', message = n::text;
  exception
    when sqlstate 'P9999' then ok := true;  n := sqlerrm::bigint; err := null;
    when others            then ok := false; n := null;            err := sqlerrm;
  end;
end;
$$;

create temp table if not exists security_results (
  no serial, who text, attempt text, expected text, passed boolean, result text
) on commit preserve rows;
truncate security_results restart identity;

do $$
declare
  m  uuid := (select id from auth.users where email = 'manager@test.ru');
  w1 uuid := (select id from auth.users where email = 'worker1@test.ru');
  w2 uuid := (select id from auth.users where email = 'worker2@test.ru');
  t_w1_work   uuid := (select id from tasks where title = 'Монтаж опалубки 3 этажа');
  t_w1_new    uuid := (select id from tasks where title = 'Установить окна');
  t_w1_acc    uuid := (select id from tasks where title = 'Залить фундамент секции Б');
  t_w2_review uuid := (select id from tasks where title = 'Гидроизоляция подвала');
  t_w2_new    uuid := (select id from tasks where title = 'Электромонтаж');
  t_reassigned uuid := (select id from tasks where title = 'Покраска стен');
  o_office    uuid := (select id from objects where name like 'Офис на Тверской%');
  o_north     uuid := (select id from objects where name like 'ЖК «Северный»%');
  r record;
  pass boolean;
begin
  if t_w1_work is null then
    raise exception 'Сначала выполните seed.sql';
  end if;

  for r in
    select * from (values
      -- ---------- без входа ----------
      ('без входа',   null::uuid, 'Прочитать задачи',            'select * from tasks', 'blocked'),
      ('без входа',   null,       'Прочитать объекты',           'select * from objects', 'blocked'),
      ('без входа',   null,       'Сменить статус через функцию', format('select change_task_status(%L, ''accepted'')', t_w1_work), 'blocked'),

      -- ---------- исполнитель 1 ----------
      ('исполнитель 1', w1, 'Видит свои задачи (контроль)',         'select * from tasks', 'allowed'),
      ('исполнитель 1', w1, 'Видит только 2 объекта со своими задачами', 'select * from objects', 'rows:2'),
      ('исполнитель 1', w1, 'Прочитать чужую задачу по id',         format('select * from tasks where id = %L', t_w2_review), 'blocked'),
      ('исполнитель 1', w1, 'Прочитать историю чужой задачи',       format('select * from task_history where task_id = %L', t_w2_review), 'blocked'),
      ('исполнитель 1', w1, 'Прочитать задачу, которую у него забрали', format('select * from tasks where id = %L', t_reassigned), 'blocked'),
      ('исполнитель 1', w1, 'Открыть объект без своих задач',       format('select * from objects where id = %L', o_office), 'blocked'),
      ('исполнитель 1', w1, 'Видит имена только себя и постановщика', 'select * from profiles', 'rows:2'),
      ('исполнитель 1', w1, 'Поставить «Принята» прямым UPDATE',    format('update tasks set status = ''accepted'' where id = %L returning 1', t_w1_work), 'blocked'),
      ('исполнитель 1', w1, 'Изменить название своей задачи',       format('update tasks set title = ''x'' where id = %L returning 1', t_w1_work), 'blocked'),
      ('исполнитель 1', w1, 'Переназначить задачу прямым UPDATE',   format('update tasks set assignee_id = %L where id = %L returning 1', w2, t_w1_work), 'blocked'),
      ('исполнитель 1', w1, 'Сам принять свою работу (функция)',    format('select change_task_status(%L, ''accepted'')', t_w1_work), 'error'),
      ('исполнитель 1', w1, 'Взять в работу чужую задачу',          format('select change_task_status(%L, ''in_progress'')', t_w2_new), 'error'),
      ('исполнитель 1', w1, 'Переназначить через функцию',          format('select reassign_task(%L, %L)', t_w1_work, w2), 'error'),
      ('исполнитель 1', w1, 'Добавить запись в историю',            format('insert into task_history (task_id, to_status) values (%L, ''accepted'') returning 1', t_w1_work), 'blocked'),
      ('исполнитель 1', w1, 'Изменить запись истории',              'update task_history set comment = ''x'' returning 1', 'blocked'),
      ('исполнитель 1', w1, 'Удалить историю',                      'delete from task_history returning 1', 'blocked'),
      ('исполнитель 1', w1, 'Назначить себе роль постановщика',     format('update profiles set role = ''manager'' where id = %L returning 1', w1), 'blocked'),
      ('исполнитель 1', w1, 'Создать объект',                       'insert into objects (name, address) values (''x'', ''y'') returning 1', 'blocked'),
      ('исполнитель 1', w1, 'Создать задачу',                       format('insert into tasks (object_id, title, assignee_id) values (%L, ''x'', %L) returning 1', o_north, w1), 'blocked'),
      ('исполнитель 1', w1, 'Удалить свою задачу',                  format('delete from tasks where id = %L returning 1', t_w1_new), 'blocked'),
      ('исполнитель 1', w1, 'Отправить на проверку (контроль)',     format('select change_task_status(%L, ''review'')', t_w1_work), 'allowed'),

      -- ---------- постановщик ----------
      ('постановщик', m, 'Видит все задачи (контроль)',             'select * from tasks', 'rows:9'),
      ('постановщик', m, 'Перескочить «Новая» → «Принята»',          format('select change_task_status(%L, ''accepted'')', t_w1_new), 'error'),
      ('постановщик', m, 'Взять задачу в работу за исполнителя',    format('select change_task_status(%L, ''in_progress'')', t_w1_new), 'error'),
      ('постановщик', m, 'Вернуть на доработку без комментария',    format('select change_task_status(%L, ''rework'')', t_w2_review), 'error'),
      ('постановщик', m, 'Отменить без комментария',                format('select change_task_status(%L, ''cancelled'', ''  '')', t_w1_new), 'error'),
      ('постановщик', m, 'Сменить статус прямым UPDATE',            format('update tasks set status = ''accepted'' where id = %L returning 1', t_w2_review), 'blocked'),
      ('постановщик', m, 'Создать задачу сразу «Принята»',          format('insert into tasks (object_id, title, assignee_id, status) values (%L, ''x'', %L, ''accepted'') returning 1', o_north, w1), 'blocked'),
      ('постановщик', m, 'Создать задачу от чужого имени',          format('insert into tasks (object_id, title, assignee_id, author_id) values (%L, ''x'', %L, %L) returning 1', o_north, w1, w1), 'blocked'),
      ('постановщик', m, 'Назначить исполнителем постановщика',     format('insert into tasks (object_id, title, assignee_id) values (%L, ''x'', %L) returning 1', o_north, m), 'error'),
      ('постановщик', m, 'Новая задача получает статус «Новая» и автора (контроль)',
                         format('with ins as (insert into tasks (object_id, title, assignee_id) values (%L, ''x'', %L) returning status, author_id) '
                                'select count(*) from ins where status = ''new'' and author_id = %L', o_north, w1, m), 'rows:1'),
      ('постановщик', m, 'Удалить задачу в работе',                 format('delete from tasks where id = %L returning 1', t_w1_work), 'error'),
      ('постановщик', m, 'Удалить задачу, которую уже брали в работу', format('delete from tasks where id = %L returning 1', t_reassigned), 'error'),
      ('постановщик', m, 'Удалить новую задачу (контроль)',         format('delete from tasks where id = %L returning 1', t_w1_new), 'allowed'),
      ('постановщик', m, 'Удалить объект с задачами',               format('delete from objects where id = %L returning 1', o_north), 'error'),
      ('постановщик', m, 'Править название принятой задачи',        format('update tasks set title = ''x'' where id = %L returning 1', t_w1_acc), 'error'),
      ('постановщик', m, 'Сменить объект у задачи в работе',        format('update tasks set object_id = %L where id = %L returning 1', o_office, t_w1_work), 'error'),
      ('постановщик', m, 'Сменить исполнителя у принятой задачи',   format('select reassign_task(%L, %L)', t_w1_acc, w2), 'error'),
      ('постановщик', m, 'Удалить историю',                         'delete from task_history returning 1', 'blocked'),
      ('постановщик', m, 'Принять работу на проверке (контроль)',   format('select change_task_status(%L, ''accepted'')', t_w2_review), 'allowed'),
      ('постановщик', m, 'Вернуть принятую с браком (контроль)',    format('select change_task_status(%L, ''rework'', ''Трещина в бетоне'')', t_w1_acc), 'allowed')
    ) as v(who, uid, attempt, sql, expected)
  loop
    declare
      res record;
    begin
      select * into res from pg_temp.try_as(r.uid, r.sql);
      pass := case
        when r.expected = 'blocked' then (not res.ok) or res.n = 0
        when r.expected = 'error'   then not res.ok
        when r.expected = 'allowed' then res.ok and res.n > 0
        when r.expected like 'rows:%' then res.ok and res.n = substr(r.expected, 6)::bigint
      end;
      insert into security_results (who, attempt, expected, passed, result)
      values (r.who, r.attempt, r.expected, pass,
              case when res.ok then 'строк: ' || res.n else 'ошибка: ' || res.err end);
    end;
  end loop;
end;
$$;

select no as "№", who as "кто", attempt as "попытка", expected as "ожидание",
       passed, result as "результат"
from security_results order by no;
