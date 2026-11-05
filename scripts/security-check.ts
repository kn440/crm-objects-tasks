/**
 * Проверка защиты через настоящий API Supabase — так, как это сделал бы
 * злоумышленник с публичным ключом из браузера, в обход интерфейса.
 *
 * Запуск: заполнить .env (см. .env.example) и выполнить `npm run security-check`.
 * Нужны только публичный ключ и пароли тестовых пользователей.
 *
 * Скрипт ничего не меняет в данных: все «атаки» должны быть отклонены,
 * а временные объект и задача, которые он создаёт, в конце удаляются.
 */
import 'dotenv/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL!;
const key = (process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY)!;
if (!url || !key) {
  console.error('Заполните VITE_SUPABASE_URL и VITE_SUPABASE_PUBLISHABLE_KEY в .env');
  process.exit(1);
}

const client = () =>
  createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function login(emailVar: string, passVar: string): Promise<{ db: SupabaseClient; id: string }> {
  const email = process.env[emailVar];
  const password = process.env[passVar];
  if (!email || !password) throw new Error(`Заполните ${emailVar} и ${passVar} в .env`);
  const db = client();
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Вход ${email}: ${error.message}`);
  return { db, id: data.user.id };
}

type Outcome = { ok: boolean; rows: number; error?: string };

async function attempt(q: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<Outcome> {
  const { data, error } = await q;
  if (error) return { ok: false, rows: 0, error: error.message };
  const rows = Array.isArray(data) ? data.length : data == null ? 0 : 1;
  return { ok: true, rows };
}

let failed = 0;
let n = 0;
function report(name: string, pass: boolean, o: Outcome) {
  n++;
  if (!pass) failed++;
  const detail = o.error ? `ошибка: ${o.error}` : `строк: ${o.rows}`;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${String(n).padStart(2)}. ${name}  —  ${detail}`);
}
const blocked = (name: string, o: Outcome) => report(name, !o.ok || o.rows === 0, o);
const rejected = (name: string, o: Outcome) => report(name, !o.ok, o);
const allowed = (name: string, o: Outcome) => report(name, o.ok && o.rows > 0, o);

async function main() {
  const anon = client();
  const m = await login('CHECK_MANAGER_EMAIL', 'CHECK_MANAGER_PASSWORD');
  const w1 = await login('CHECK_WORKER1_EMAIL', 'CHECK_WORKER1_PASSWORD');
  const w2 = await login('CHECK_WORKER2_EMAIL', 'CHECK_WORKER2_PASSWORD');

  // Задачи из тестовых данных (seed.sql), на которых проверяем атаки
  const pick = async (filter: (q: any) => any) => {
    const { data } = await filter(m.db.from('tasks').select('id, object_id, status, assignee_id')).limit(1);
    return data?.[0] as { id: string; object_id: string } | undefined;
  };
  const tWork = await pick((q) => q.eq('assignee_id', w1.id).eq('status', 'in_progress'));
  const tReview = await pick((q) => q.eq('status', 'review'));
  const tOther = await pick((q) => q.eq('assignee_id', w2.id));
  if (!tWork || !tReview || !tOther) {
    throw new Error('Не найдены задачи из seed.sql: у исполнителя 1 нужна задача «В работе», у исполнителя 2 — любая, и одна «На проверке»');
  }

  // Законное действие постановщика: временный объект и задача (в конце удаляются)
  const { data: obj, error: e1 } = await m.db
    .from('objects').insert({ name: 'Временный объект проверки', address: 'тест' }).select('id').single();
  if (e1) throw e1;
  const { data: tNew, error: e2 } = await m.db
    .from('tasks').insert({ object_id: obj.id, title: 'Временная задача', assignee_id: w1.id }).select('*').single();
  if (e2) throw e2;

  console.log('\n— Без входа —');
  blocked('Прочитать задачи', await attempt(anon.from('tasks').select('*')));
  blocked('Прочитать историю', await attempt(anon.from('task_history').select('*')));
  rejected('Вызвать смену статуса', await attempt(anon.rpc('change_task_status', { p_task_id: tWork.id, p_new_status: 'accepted' })));
  const signUp = await anon.auth.signUp({ email: `intruder${Date.now()}@test.ru`, password: 'Intruder123!' });
  report('Зарегистрироваться самому', Boolean(signUp.error), { ok: !signUp.error, rows: 0, error: signUp.error?.message });

  console.log('\n— Исполнитель 1 —');
  allowed('Видит свои задачи (контроль)', await attempt(w1.db.from('tasks').select('id')));
  blocked('Прочитать задачу исполнителя 2', await attempt(w1.db.from('tasks').select('*').eq('id', tOther.id)));
  blocked('Прочитать историю задачи исполнителя 2', await attempt(w1.db.from('task_history').select('*').eq('task_id', tOther.id)));
  blocked('Поставить «Принята» прямым UPDATE', await attempt(w1.db.from('tasks').update({ status: 'accepted' }).eq('id', tWork.id).select()));
  blocked('Изменить название своей задачи', await attempt(w1.db.from('tasks').update({ title: 'взлом' }).eq('id', tWork.id).select()));
  blocked('Переназначить чужую задачу на себя', await attempt(w1.db.from('tasks').update({ assignee_id: w1.id }).eq('id', tOther.id).select()));
  rejected('Перескочить «Новая» → «На проверке»', await attempt(w1.db.rpc('change_task_status', { p_task_id: tNew.id, p_new_status: 'review' })));
  rejected('Самому принять свою работу', await attempt(w1.db.rpc('change_task_status', { p_task_id: tWork.id, p_new_status: 'accepted' })));
  rejected('Взять в работу чужую задачу', await attempt(w1.db.rpc('change_task_status', { p_task_id: tOther.id, p_new_status: 'in_progress' })));
  rejected('Добавить запись в историю', await attempt(w1.db.from('task_history').insert({ task_id: tWork.id, to_status: 'accepted' })));
  blocked('Изменить запись истории', await attempt(w1.db.from('task_history').update({ comment: 'подделка' }).eq('task_id', tWork.id).select()));
  blocked('Удалить историю', await attempt(w1.db.from('task_history').delete().eq('task_id', tWork.id).select()));
  blocked('Назначить себе роль постановщика', await attempt(w1.db.from('profiles').update({ role: 'manager' }).eq('id', w1.id).select()));
  const meta = await w1.db.auth.updateUser({ data: { role: 'manager' } });
  const asManager = await attempt(w1.db.from('tasks').select('*').eq('id', tOther.id));
  report('Роль «manager» в своих метаданных ничего не даёт', !meta.error && asManager.rows === 0, asManager);
  await w1.db.auth.updateUser({ data: { role: null } });
  rejected('Создать объект', await attempt(w1.db.from('objects').insert({ name: 'x', address: 'y' })));
  rejected('Создать задачу', await attempt(w1.db.from('tasks').insert({ object_id: obj.id, title: 'x', assignee_id: w1.id })));

  console.log('\n— Постановщик —');
  report('Новая задача получила статус «Новая» и автора от базы', tNew.status === 'new' && tNew.author_id === m.id, { ok: true, rows: 1 });
  rejected('Создать задачу сразу «Принята»', await attempt(m.db.from('tasks').insert({ object_id: obj.id, title: 'x', assignee_id: w1.id, status: 'accepted' })));
  rejected('Создать задачу от чужого имени', await attempt(m.db.from('tasks').insert({ object_id: obj.id, title: 'x', assignee_id: w1.id, author_id: w1.id })));
  blocked('Сменить статус прямым UPDATE', await attempt(m.db.from('tasks').update({ status: 'accepted' }).eq('id', tReview.id).select()));
  rejected('Принять задачу, которая ещё в работе', await attempt(m.db.rpc('change_task_status', { p_task_id: tWork.id, p_new_status: 'accepted' })));
  rejected('Вернуть на доработку без комментария', await attempt(m.db.rpc('change_task_status', { p_task_id: tReview.id, p_new_status: 'rework' })));
  rejected('Удалить задачу в работе', await attempt(m.db.from('tasks').delete().eq('id', tWork.id).select()));
  rejected('Удалить объект с задачами', await attempt(m.db.from('objects').delete().eq('id', tWork.object_id).select()));
  blocked('Удалить историю', await attempt(m.db.from('task_history').delete().eq('task_id', tWork.id).select()));

  // Уборка: новую задачу (её не брали в работу) и пустой объект удалить можно
  allowed('Удалить новую задачу (контроль)', await attempt(m.db.from('tasks').delete().eq('id', tNew.id).select()));
  allowed('Удалить пустой объект (контроль)', await attempt(m.db.from('objects').delete().eq('id', obj.id).select()));

  console.log(`\nИтого: ${n - failed} из ${n} проверок пройдено.`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
