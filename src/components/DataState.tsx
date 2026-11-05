import { Alert, Button, Center, Loader } from '@mantine/core';
import type { ReactNode } from 'react';
import { errorText } from '../lib/errors';

/** Общая обёртка: загрузка, ошибка, «не найдено» */
export function DataState({
  loading,
  error,
  empty,
  emptyText = 'Не найдено или нет доступа',
  onRetry,
  children,
}: {
  loading: boolean;
  error: unknown;
  empty?: boolean;
  emptyText?: string;
  onRetry?: () => void;
  children: ReactNode;
}) {
  if (error) {
    return (
      <Alert color="red" title="Не удалось загрузить данные">
        {errorText(error)}
        {onRetry && (
          <Button size="xs" variant="light" color="red" mt="sm" display="block" onClick={onRetry}>
            Повторить
          </Button>
        )}
      </Alert>
    );
  }
  if (loading && empty !== false) {
    return (
      <Center py="xl">
        <Loader />
      </Center>
    );
  }
  if (empty) return <Alert color="gray">{emptyText}</Alert>;
  return <>{children}</>;
}
