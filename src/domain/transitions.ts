// Матрица переходов статусов — та же, что в функции public.transition_allowed в базе.
// Здесь она нужна только для того, чтобы показать пользователю доступные кнопки.
// Решение о переходе всё равно принимает база: если интерфейс ошибётся,
// запрос будет отклонён.

export type TaskStatus = 'new' | 'in_progress' | 'review' | 'rework' | 'accepted' | 'cancelled';
export type Role = 'manager' | 'executor';

export const STATUS_LABEL: Record<TaskStatus, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  review: 'На проверке',
  rework: 'На доработке',
  accepted: 'Принята',
  cancelled: 'Отменена',
};

/** Цвет статуса в палитре Mantine (бейджи, история) */
export const STATUS_COLOR: Record<TaskStatus, string> = {
  new: 'gray',
  in_progress: 'blueprint',
  review: 'yellow',
  rework: 'orange',
  accepted: 'green',
  cancelled: 'dark',
};

/** Тот же цвет для полос и кромок */
export const STATUS_HEX: Record<TaskStatus, string> = {
  new: '#94a3b0',
  in_progress: '#1f5fad',
  review: '#f5b301',
  rework: '#e8590c',
  accepted: '#2f9e44',
  cancelled: '#5b6b7a',
};

export const STATUS_ORDER: TaskStatus[] = ['new', 'in_progress', 'review', 'rework', 'accepted', 'cancelled'];

export const ROLE_LABEL: Record<Role, string> = {
  manager: 'Постановщик',
  executor: 'Исполнитель',
};

/** Статусы, после которых задача только для чтения */
export const FINAL_STATUSES: TaskStatus[] = ['accepted', 'cancelled'];
export const isFinal = (s: TaskStatus) => FINAL_STATUSES.includes(s);

export interface Transition {
  from: TaskStatus[];
  to: TaskStatus;
  /** Кто может: постановщик или назначенный исполнитель */
  role: Role;
  label: string;
  commentRequired: boolean;
  color: string;
  variant: 'filled' | 'light' | 'outline';
}

export const TRANSITIONS: Transition[] = [
  { from: ['new'], to: 'in_progress', role: 'executor', label: 'Взять в работу', commentRequired: false, color: 'blueprint', variant: 'filled' },
  { from: ['in_progress'], to: 'review', role: 'executor', label: 'Отправить на проверку', commentRequired: false, color: 'yellow', variant: 'filled' },
  { from: ['rework'], to: 'in_progress', role: 'executor', label: 'Вернуться к работе', commentRequired: false, color: 'blueprint', variant: 'filled' },
  { from: ['review'], to: 'accepted', role: 'manager', label: 'Принять', commentRequired: false, color: 'green', variant: 'filled' },
  { from: ['review'], to: 'rework', role: 'manager', label: 'Вернуть на доработку', commentRequired: true, color: 'orange', variant: 'light' },
  { from: ['accepted'], to: 'rework', role: 'manager', label: 'Вернуть: обнаружен брак', commentRequired: true, color: 'orange', variant: 'light' },
  { from: ['new', 'in_progress', 'review', 'rework'], to: 'cancelled', role: 'manager', label: 'Отменить задачу', commentRequired: true, color: 'red', variant: 'outline' },
];

export interface CurrentUser {
  id: string;
  role: Role;
}

export interface TaskLike {
  status: TaskStatus;
  assignee_id: string;
}

/** Переходы, доступные пользователю для задачи в её текущем статусе */
export function availableTransitions(task: TaskLike, user: CurrentUser): Transition[] {
  return TRANSITIONS.filter((t) => {
    if (!t.from.includes(task.status)) return false;
    if (t.role === 'manager') return user.role === 'manager';
    return user.role === 'executor' && task.assignee_id === user.id;
  });
}

/** Редактировать название и описание: постановщик, пока задача не завершена */
export const canEditTask = (task: TaskLike, user: CurrentUser) =>
  user.role === 'manager' && !isFinal(task.status);

/** Сменить объект задачи: постановщик, только в статусе «Новая» */
export const canChangeObject = (task: TaskLike, user: CurrentUser) =>
  user.role === 'manager' && task.status === 'new';

/** Сменить исполнителя: постановщик, пока задача не завершена */
export const canReassign = canEditTask;

/** Удалить: постановщик, задача «Новая» и её ни разу не брали в работу */
export const canDeleteTask = (task: TaskLike, user: CurrentUser, everStarted: boolean) =>
  user.role === 'manager' && task.status === 'new' && !everStarted;
