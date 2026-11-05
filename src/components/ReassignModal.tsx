import { Alert, Button, Group, Modal, Select, Stack, Textarea } from '@mantine/core';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { showError, showSuccess } from '../lib/errors';
import { STATUS_LABEL, type TaskStatus } from '../domain/transitions';

/** Смена исполнителя: задача возвращается в «Новая», событие пишется в историю */
export function ReassignModal({
  opened,
  onClose,
  taskId,
  currentAssigneeId,
  status,
  onDone,
}: {
  opened: boolean;
  onClose: () => void;
  taskId: string;
  currentAssigneeId: string;
  status: TaskStatus;
  onDone: () => void;
}) {
  const [executors, setExecutors] = useState<{ value: string; label: string }[]>([]);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!opened) return;
    setAssigneeId(null);
    setComment('');
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'executor')
      .neq('id', currentAssigneeId)
      .order('full_name')
      .then(({ data }) => setExecutors((data ?? []).map((p) => ({ value: p.id, label: p.full_name }))));
  }, [opened, currentAssigneeId]);

  const save = async () => {
    if (!assigneeId) return;
    setBusy(true);
    const { error } = await supabase.rpc('reassign_task', {
      p_task_id: taskId,
      p_assignee_id: assigneeId,
      p_comment: comment.trim() || null,
    });
    setBusy(false);
    if (error) return showError(error);
    showSuccess('Исполнитель изменён');
    onDone();
    onClose();
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Сменить исполнителя">
      <Stack>
        {status !== 'new' && (
          <Alert color="yellow">
            Задача сейчас «{STATUS_LABEL[status]}». После смены она вернётся в статус «Новая»,
            и новый исполнитель сам возьмёт её в работу.
          </Alert>
        )}
        <Select label="Новый исполнитель" required data={executors} value={assigneeId} onChange={setAssigneeId} />
        <Textarea label="Причина" description="Необязательно, попадёт в историю" autosize minRows={2} value={comment} onChange={(e) => setComment(e.currentTarget.value)} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Отмена</Button>
          <Button onClick={save} loading={busy} disabled={!assigneeId}>Сменить</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
