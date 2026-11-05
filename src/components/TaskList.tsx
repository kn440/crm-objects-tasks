import { Card, Group, Stack, Text } from '@mantine/core';
import { IconUser } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { STATUS_HEX } from '../domain/transitions';
import { formatDate } from '../lib/errors';
import type { TaskListItem } from '../lib/types';
import { StatusBadge } from './StatusBadge';

/**
 * Список задач карточками с цветной кромкой по статусу.
 * showObject — для «Моих задач», showAssignee — для карточки объекта.
 */
export function TaskList({
  tasks,
  showObject = false,
  showAssignee = false,
}: {
  tasks: TaskListItem[];
  showObject?: boolean;
  showAssignee?: boolean;
}) {
  return (
    <Stack gap="xs">
      {tasks.map((t) => (
        <Card
          key={t.id}
          component={Link}
          to={`/tasks/${t.id}`}
          className="card-link task-row"
          padding="md"
          style={{ ['--edge' as string]: STATUS_HEX[t.status] }}
        >
          <Group justify="space-between" wrap="nowrap" align="flex-start" gap="sm">
            <div style={{ minWidth: 0 }}>
              <Text fw={600} lh={1.35}>{t.title}</Text>
              <Group gap="md" mt={4} wrap="wrap">
                {showObject && t.object && <Text size="sm" c="dimmed">{t.object.name}</Text>}
                {showAssignee && (
                  <Group gap={4} wrap="nowrap">
                    <IconUser size={14} color="var(--steel)" />
                    <Text size="sm" c="dimmed">{t.assignee?.full_name ?? '—'}</Text>
                  </Group>
                )}
              </Group>
            </div>
            <Stack gap={6} align="flex-end" style={{ flexShrink: 0 }}>
              <StatusBadge status={t.status} />
              <Text size="xs" c="dimmed">{formatDate(t.updated_at)}</Text>
            </Stack>
          </Group>
        </Card>
      ))}
    </Stack>
  );
}
