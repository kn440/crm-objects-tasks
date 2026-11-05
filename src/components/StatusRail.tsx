import { Group, Text, Tooltip } from '@mantine/core';
import { STATUS_HEX, STATUS_LABEL, STATUS_ORDER, type TaskStatus } from '../domain/transitions';

/** Полоса: сколько задач объекта на каждом этапе */
export function StatusRail({ statuses }: { statuses: TaskStatus[] }) {
  const counts = STATUS_ORDER.map((s) => ({ status: s, n: statuses.filter((x) => x === s).length })).filter(
    (c) => c.n > 0,
  );

  if (statuses.length === 0) {
    return <Text size="sm" c="dimmed">Задач пока нет</Text>;
  }

  return (
    <div>
      <div className="status-rail" role="img" aria-label={counts.map((c) => `${STATUS_LABEL[c.status]}: ${c.n}`).join(', ')}>
        {counts.map((c) => (
          <Tooltip key={c.status} label={`${STATUS_LABEL[c.status]}: ${c.n}`} withArrow>
            <span style={{ flexGrow: c.n, background: STATUS_HEX[c.status] }} />
          </Tooltip>
        ))}
      </div>
      <Group gap={12} mt={8} wrap="wrap">
        {counts.map((c) => (
          <Group key={c.status} gap={6} wrap="nowrap">
            <span style={{ width: 8, height: 8, borderRadius: 2, background: STATUS_HEX[c.status] }} />
            <Text size="xs" c="dimmed">
              {STATUS_LABEL[c.status]} <Text span fw={600} c="dark" size="xs">{c.n}</Text>
            </Text>
          </Group>
        ))}
      </Group>
    </div>
  );
}
