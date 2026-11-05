import { Badge } from '@mantine/core';
import { STATUS_COLOR, STATUS_HEX, STATUS_LABEL, type TaskStatus } from '../domain/transitions';

export function StatusBadge({ status, size = 'md' }: { status: TaskStatus; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <Badge
      color={STATUS_COLOR[status]}
      variant="light"
      size={size}
      style={{ flexShrink: 0 }}
      leftSection={
        <span
          style={{ width: 7, height: 7, borderRadius: 7, background: STATUS_HEX[status], display: 'inline-block' }}
        />
      }
    >
      {STATUS_LABEL[status]}
    </Badge>
  );
}
