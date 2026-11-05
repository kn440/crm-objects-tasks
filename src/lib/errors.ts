import { notifications } from '@mantine/notifications';

interface DbError {
  message?: string;
  code?: string;
}

/** Текст ошибки базы для пользователя. Наши функции и триггеры уже пишут по-русски. */
export function errorText(error: unknown): string {
  const e = (error ?? {}) as DbError;
  const msg = e.message ?? String(error);
  if (e.code === '42501' && /permission denied/i.test(msg)) return 'Недостаточно прав для этого действия';
  if (/row-level security/i.test(msg)) return 'Недостаточно прав для этого действия';
  if (/Invalid login credentials/i.test(msg)) return 'Неверный email или пароль';
  if (/Failed to fetch/i.test(msg)) return 'Нет связи с сервером';
  return msg;
}

export function showError(error: unknown, title = 'Не получилось') {
  notifications.show({ color: 'red', title, message: errorText(error) });
}

export function showSuccess(message: string) {
  notifications.show({ color: 'green', message });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
