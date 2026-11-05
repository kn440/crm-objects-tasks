import {
  ActionIcon,
  Alert,
  Anchor,
  Breadcrumbs,
  Card,
  Grid,
  Group,
  Menu,
  Stack,
  Text,
  Timeline,
  Title,
} from '@mantine/core';
import {
  IconArrowBackUp,
  IconBan,
  IconBuildingSkyscraper,
  IconCalendar,
  IconDots,
  IconPencil,
  IconRefresh,
  IconTrash,
  IconUser,
  IconUserEdit,
  IconUserShield,
} from '@tabler/icons-react';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMe } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import { useLoad } from '../lib/useLoad';
import { formatDate, showError, showSuccess } from '../lib/errors';
import type { HistoryRow, TaskDetails } from '../lib/types';
import { DataState } from '../components/DataState';
import { StatusBadge } from '../components/StatusBadge';
import { TaskActions } from '../components/TaskActions';
import { TaskFormModal } from '../components/TaskFormModal';
import { ReassignModal } from '../components/ReassignModal';
import { Lifecycle } from '../components/Lifecycle';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  STATUS_COLOR,
  STATUS_LABEL,
  canChangeObject,
  canDeleteTask,
  canEditTask,
  canReassign,
  type Role,
  type TaskStatus,
} from '../domain/transitions';

/** Подсказка: что сейчас происходит с задачей и чего ждут от пользователя */
const HINT: Record<TaskStatus, Record<Role, string>> = {
  new: {
    executor: 'Задача назначена вам. Возьмите её в работу, когда начнёте.',
    manager: 'Ждёт, пока исполнитель возьмёт задачу в работу.',
  },
  in_progress: {
    executor: 'Когда закончите, отправьте работу на проверку.',
    manager: 'Исполнитель работает над задачей.',
  },
  review: {
    executor: 'Работа на проверке у постановщика.',
    manager: 'Исполнитель сдал работу. Примите её или верните с комментарием.',
  },
  rework: {
    executor: 'Задачу вернули на доработку. Исправьте замечания и продолжите работу.',
    manager: 'Задача у исполнителя на доработке.',
  },
  accepted: {
    executor: 'Работа принята.',
    manager: 'Работа принята. Если позже обнаружится брак, задачу можно вернуть на доработку.',
  },
  cancelled: {
    executor: 'Задача отменена и больше не изменяется.',
    manager: 'Задача отменена и больше не изменяется.',
  },
};

export function TaskPage() {
  const { id } = useParams<{ id: string }>();
  const me = useMe();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [reassigning, setReassigning] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data, error, loading, reload } = useLoad(async () => {
    const [task, history] = await Promise.all([
      supabase
        .from('tasks')
        .select(
          '*, object:objects(id, name, address), ' +
            'assignee:profiles!tasks_assignee_id_fkey(id, full_name), ' +
            'author:profiles!tasks_author_id_fkey(id, full_name)',
        )
        .eq('id', id!)
        .maybeSingle(),
      supabase
        .from('task_history')
        .select('id, created_at, from_status, to_status, comment, actor:profiles!task_history_actor_id_fkey(full_name)')
        .eq('task_id', id!)
        .order('created_at')
        .order('id'),
    ]);
    if (task.error) throw task.error;
    if (history.error) throw history.error;
    return {
      task: task.data as unknown as TaskDetails | null,
      history: history.data as unknown as HistoryRow[],
    };
  }, [id]);

  const task = data?.task;
  const history = data?.history ?? [];
  const everStarted = history.some((h) => h.to_status === 'in_progress');
  const reworkCount = history.filter((h) => h.to_status === 'rework').length;
  const lastReturn = [...history].reverse().find((h) => h.to_status === 'rework');
  const cancellation = [...history].reverse().find((h) => h.to_status === 'cancelled');

  const remove = async () => {
    if (!task) return;
    const { error } = await supabase.from('tasks').delete().eq('id', task.id);
    if (error) {
      setDeleting(false);
      return showError(error);
    }
    showSuccess('Задача удалена');
    navigate(task.object ? `/objects/${task.object.id}` : '/objects');
  };

  return (
    <DataState loading={loading} error={error} empty={!task} onRetry={reload} emptyText="Задача не найдена или у вас нет к ней доступа">
      {task && (
        <Stack gap="lg">
          <Breadcrumbs separatorMargin={6}>
            {me.role === 'executor' ? (
              <Anchor component={Link} to="/my-tasks" size="sm">Мои задачи</Anchor>
            ) : (
              <Anchor component={Link} to="/objects" size="sm">Объекты</Anchor>
            )}
            {task.object && (
              <Anchor component={Link} to={`/objects/${task.object.id}`} size="sm" truncate maw={220}>
                {task.object.name}
              </Anchor>
            )}
          </Breadcrumbs>

          <Grid gutter="lg">
            <Grid.Col span={{ base: 12, md: 7 }}>
              <Stack gap="lg">
                {/* Заголовок, этапы и действия */}
                <Card>
                  <Stack gap="lg">
                    <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
                      <div style={{ minWidth: 0 }}>
                        <StatusBadge status={task.status} />
                        <Title order={1} mt={10}>{task.title}</Title>
                      </div>
                      {me.role === 'manager' && (
                        <Menu position="bottom-end" shadow="md" width={260}>
                          <Menu.Target>
                            <ActionIcon variant="default" size="lg" aria-label="Действия с задачей">
                              <IconDots size={18} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item
                              leftSection={<IconPencil size={16} />}
                              disabled={!canEditTask(task, me)}
                              onClick={() => setEditing(true)}
                            >
                              Редактировать
                            </Menu.Item>
                            <Menu.Item
                              leftSection={<IconUserEdit size={16} />}
                              disabled={!canReassign(task, me)}
                              onClick={() => setReassigning(true)}
                            >
                              Сменить исполнителя
                            </Menu.Item>
                            <Menu.Divider />
                            {canDeleteTask(task, me, everStarted) ? (
                              <Menu.Item color="red" leftSection={<IconTrash size={16} />} onClick={() => setDeleting(true)}>
                                Удалить задачу
                              </Menu.Item>
                            ) : (
                              <Menu.Item leftSection={<IconTrash size={16} />} disabled>
                                <Text size="sm">Удалить нельзя</Text>
                                <Text size="xs" c="dimmed">
                                  {everStarted
                                    ? 'По задаче уже велась работа, её история сохраняется. Используйте отмену.'
                                    : 'Удалить можно только новую задачу. Используйте отмену.'}
                                </Text>
                              </Menu.Item>
                            )}
                          </Menu.Dropdown>
                        </Menu>
                      )}
                    </Group>

                    <Lifecycle status={task.status} />

                    {task.status === 'rework' && lastReturn?.comment && (
                      <Alert color="orange" variant="light" icon={<IconArrowBackUp size={18} />} title="Замечания при возврате">
                        <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{lastReturn.comment}</Text>
                        <Text size="xs" c="dimmed" mt={4}>
                          {lastReturn.actor?.full_name}, {formatDate(lastReturn.created_at)}
                        </Text>
                      </Alert>
                    )}

                    {task.status === 'cancelled' && cancellation?.comment && (
                      <Alert color="gray" variant="light" icon={<IconBan size={18} />} title="Причина отмены">
                        <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{cancellation.comment}</Text>
                        <Text size="xs" c="dimmed" mt={4}>
                          {cancellation.actor?.full_name}, {formatDate(cancellation.created_at)}
                        </Text>
                      </Alert>
                    )}

                    <div>
                      <Text size="sm" c="dimmed" mb="sm">{HINT[task.status][me.role]}</Text>
                      <TaskActions taskId={task.id} task={task} user={me} onChanged={reload} />
                    </div>
                  </Stack>
                </Card>

                {/* Описание и данные */}
                <Card>
                  <Text fw={700} mb={6}>Описание</Text>
                  <Text style={{ whiteSpace: 'pre-wrap' }} c={task.description ? undefined : 'dimmed'}>
                    {task.description || 'Описания нет'}
                  </Text>

                  <Grid mt="lg" gutter="md">
                    <Fact icon={<IconBuildingSkyscraper size={18} />} label="Объект">
                      {task.object ? (
                        <>
                          <Anchor component={Link} to={`/objects/${task.object.id}`}>{task.object.name}</Anchor>
                          <Text size="xs" c="dimmed">{task.object.address}</Text>
                        </>
                      ) : '—'}
                    </Fact>
                    <Fact icon={<IconUser size={18} />} label="Исполнитель">{task.assignee?.full_name ?? '—'}</Fact>
                    <Fact icon={<IconUserShield size={18} />} label="Автор">{task.author?.full_name ?? '—'}</Fact>
                    <Fact icon={<IconCalendar size={18} />} label="Создана">{formatDate(task.created_at)}</Fact>
                    <Fact icon={<IconRefresh size={18} />} label="Изменена">{formatDate(task.updated_at)}</Fact>
                    <Fact icon={<IconArrowBackUp size={18} />} label="Возвратов на доработку">{reworkCount}</Fact>
                  </Grid>
                </Card>
              </Stack>
            </Grid.Col>

            {/* История */}
            <Grid.Col span={{ base: 12, md: 5 }}>
              <Card>
                <Group justify="space-between" mb="lg">
                  <Text fw={700}>История</Text>
                  <Text size="xs" c="dimmed">записей: {history.length}</Text>
                </Group>
                <Timeline active={history.length} bulletSize={14} lineWidth={2}>
                  {history.map((h) => (
                    <Timeline.Item
                      key={h.id}
                      color={STATUS_COLOR[h.to_status]}
                      title={
                        <Text size="sm" fw={600}>
                          {h.from_status
                            ? `${STATUS_LABEL[h.from_status]} → ${STATUS_LABEL[h.to_status]}`
                            : 'Задача создана'}
                        </Text>
                      }
                    >
                      <Text size="xs" c="dimmed" mt={2}>
                        {h.actor?.full_name ?? 'Пользователь'}, {formatDate(h.created_at)}
                      </Text>
                      {h.comment && <Text size="sm" mt={6} className="history-comment">{h.comment}</Text>}
                    </Timeline.Item>
                  ))}
                </Timeline>
              </Card>
            </Grid.Col>
          </Grid>

          <ConfirmDialog
            opened={deleting}
            onClose={() => setDeleting(false)}
            title="Удалить задачу?"
            confirmLabel="Удалить"
            onConfirm={remove}
          >
            Задача «{task.title}» будет удалена без возможности восстановления.
          </ConfirmDialog>
          <TaskFormModal
            opened={editing}
            onClose={() => setEditing(false)}
            task={task}
            objectEditable={canChangeObject(task, me)}
            onSaved={() => reload()}
          />
          <ReassignModal
            opened={reassigning}
            onClose={() => setReassigning(false)}
            taskId={task.id}
            currentAssigneeId={task.assignee_id}
            status={task.status}
            onDone={reload}
          />
        </Stack>
      )}
    </DataState>
  );
}

function Fact({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <Grid.Col span={{ base: 12, xs: 6 }}>
      <Group gap="sm" wrap="nowrap" align="flex-start">
        <Text c="dimmed" mt={2} style={{ display: 'flex' }}>{icon}</Text>
        <div style={{ minWidth: 0 }}>
          <Text size="xs" c="dimmed">{label}</Text>
          <div>{children}</div>
        </div>
      </Group>
    </Grid.Col>
  );
}
