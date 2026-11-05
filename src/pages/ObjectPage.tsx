import { ActionIcon, Anchor, Breadcrumbs, Button, Card, Group, Menu, Stack, Text, Title } from '@mantine/core';
import { IconDots, IconMapPin, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMe } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import { useLoad } from '../lib/useLoad';
import { showError, showSuccess } from '../lib/errors';
import type { ObjectRow, TaskListItem } from '../lib/types';
import { DataState } from '../components/DataState';
import { ObjectFormModal } from '../components/ObjectFormModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { TaskFormModal } from '../components/TaskFormModal';
import { TaskList } from '../components/TaskList';
import { StatusRail } from '../components/StatusRail';
import { STATUS_ORDER } from '../domain/transitions';

export function ObjectPage() {
  const { id } = useParams<{ id: string }>();
  const me = useMe();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data, error, loading, reload } = useLoad(async () => {
    const [obj, tasks] = await Promise.all([
      supabase.from('objects').select('*').eq('id', id!).maybeSingle(),
      supabase
        .from('tasks')
        .select('id, title, status, updated_at, assignee:profiles!tasks_assignee_id_fkey(full_name)')
        .eq('object_id', id!)
        .order('created_at'),
    ]);
    if (obj.error) throw obj.error;
    if (tasks.error) throw tasks.error;
    const list = (tasks.data as unknown as TaskListItem[]).sort(
      (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
    );
    return { object: obj.data as ObjectRow | null, tasks: list };
  }, [id]);

  const object = data?.object;

  const remove = async () => {
    if (!object) return;
    const { error } = await supabase.from('objects').delete().eq('id', object.id);
    if (error) {
      setDeleting(false);
      return showError(error);
    }
    showSuccess('Объект удалён');
    navigate('/objects');
  };

  return (
    <DataState loading={loading} error={error} empty={!object} onRetry={reload} emptyText="Объект не найден или у вас нет к нему доступа">
      {object && data && (
        <Stack gap="lg">
          <Breadcrumbs separatorMargin={6}>
            <Anchor component={Link} to="/objects" size="sm">Объекты</Anchor>
            <Text size="sm" c="dimmed" truncate maw={260}>{object.name}</Text>
          </Breadcrumbs>

          <Card>
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <div style={{ minWidth: 0 }}>
                <Title order={1}>{object.name}</Title>
                <Group gap={6} mt={6} wrap="nowrap" align="flex-start">
                  <IconMapPin size={17} color="var(--steel)" style={{ flexShrink: 0, marginTop: 2 }} />
                  <Text c="dimmed">{object.address}</Text>
                </Group>
              </div>
              {me.role === 'manager' && (
                <Menu position="bottom-end" shadow="md">
                  <Menu.Target>
                    <ActionIcon variant="default" size="lg" aria-label="Действия с объектом">
                      <IconDots size={18} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item leftSection={<IconPencil size={16} />} onClick={() => setEditing(true)}>
                      Редактировать объект
                    </Menu.Item>
                    <Menu.Item
                      color="red"
                      leftSection={<IconTrash size={16} />}
                      disabled={data.tasks.length > 0}
                      onClick={() => setDeleting(true)}
                    >
                      {data.tasks.length > 0 ? 'Удалить можно только пустой объект' : 'Удалить объект'}
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              )}
            </Group>
            {data.tasks.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <StatusRail statuses={data.tasks.map((t) => t.status)} />
              </div>
            )}
          </Card>

          <Group justify="space-between" align="center">
            <Title order={3}>{me.role === 'manager' ? 'Задачи' : 'Мои задачи на объекте'}</Title>
            {me.role === 'manager' && (
              <Button leftSection={<IconPlus size={18} />} onClick={() => setCreatingTask(true)}>
                Новая задача
              </Button>
            )}
          </Group>

          {data.tasks.length === 0 ? (
            <Card>
              <Text c="dimmed">
                {me.role === 'manager' ? 'Задач пока нет. Создайте первую и назначьте исполнителя.' : 'Задач нет.'}
              </Text>
            </Card>
          ) : (
            <TaskList tasks={data.tasks} showAssignee={me.role === 'manager'} />
          )}

          <ConfirmDialog
            opened={deleting}
            onClose={() => setDeleting(false)}
            title="Удалить объект?"
            confirmLabel="Удалить"
            onConfirm={remove}
          >
            Объект «{object.name}» будет удалён без возможности восстановления.
          </ConfirmDialog>
          <ObjectFormModal opened={editing} onClose={() => setEditing(false)} object={object} onSaved={() => reload()} />
          <TaskFormModal
            opened={creatingTask}
            onClose={() => setCreatingTask(false)}
            defaultObjectId={object.id}
            objectEditable
            onSaved={(taskId) => navigate(`/tasks/${taskId}`)}
          />
        </Stack>
      )}
    </DataState>
  );
}
