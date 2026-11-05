import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import { useState, type ReactNode } from 'react';

/** Подтверждение необратимого действия в стиле приложения (вместо window.confirm) */
export function ConfirmDialog({
  opened,
  onClose,
  title,
  children,
  confirmLabel,
  onConfirm,
}: {
  opened: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title={<Text fw={700}>{title}</Text>} centered>
      <Stack>
        <Text size="sm">{children}</Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} data-autofocus>
            Отмена
          </Button>
          <Button color="red" loading={busy} onClick={confirm}>
            {confirmLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
