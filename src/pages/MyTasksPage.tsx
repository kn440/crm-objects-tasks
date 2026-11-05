import { Card, Group, SegmentedControl, Stack, Text, Title } from '@mantine/core';
import { useState } from 'react';
import { useMe } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import { useLoad } from '../lib/useLoad';
import type { TaskListItem } from '../lib/types';
import { DataState } from '../components/DataState';
import { TaskList } from '../components/TaskList';
import { STATUS_ORDER, isFinal } from '../domain/transitions';

type Filter = 'active' | 'done';

// Сначала то, что требует действия исполнителя
const PRIORITY: Record<string, number> = { rework: 0, new: 1, in_progress: 2, review: 3 };

export function MyTasksPage() {
  const me = useMe();
  const [filter, setFilter] = useState<Filter>('active');

  const { data, error, loading, reload } = useLoad(async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('id, title, status, updated_at, assignee:profiles!tasks_assignee_id_fkey(full_name), object:objects(id, name)')
      .eq('assignee_id', me.id)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return data as unknown as TaskListItem[];
  }, [me.id]);

  const all = data ?? [];
  const active = all.filter((t) => !isFinal(t.status));
  const tasks = (filter === 'active' ? active : all.filter((t) => isFinal(t.status))).sort((a, b) =>
    filter === 'active'
      ? PRIORITY[a.status] - PRIORITY[b.status]
      : STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
  );
  const needAction = active.filter((t) => t.status === 'rework' || t.status === 'new').length;

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={1}>Мои задачи</Title>
          <Text c="dimmed" size="sm" mt={4}>
            {needAction > 0 ? `Ждут ваших действий: ${needAction}` : 'Новых и возвращённых задач нет'}
          </Text>
        </div>
        <SegmentedControl
          value={filter}
          onChange={(v) => setFilter(v as Filter)}
          data={[
            { value: 'active', label: `Активные (${active.length})` },
            { value: 'done', label: 'Завершённые' },
          ]}
        />
      </Group>

      <DataState loading={loading} error={error} empty={!data} onRetry={reload}>
        {tasks.length === 0 ? (
          <Card>
            <Text c="dimmed">{filter === 'active' ? 'Активных задач нет.' : 'Завершённых задач пока нет.'}</Text>
          </Card>
        ) : (
          <TaskList tasks={tasks} showObject />
        )}
      </DataState>
    </Stack>
  );
}
