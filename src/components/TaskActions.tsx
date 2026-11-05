import { Button, Group, Modal, Stack, Text, Textarea } from '@mantine/core';
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { showError, showSuccess } from '../lib/errors';
import { STATUS_LABEL, availableTransitions, type CurrentUser, type TaskLike, type Transition } from '../domain/transitions';

/**
 * Кнопки смены статуса. Показываются только доступные пользователю переходы.
 * Сам переход выполняет функция базы change_task_status — она же всё проверяет.
 */
export function TaskActions({
  taskId,
  task,
  user,
  onChanged,
}: {
  taskId: string;
  task: TaskLike;
  user: CurrentUser;
  onChanged: () => void;
}) {
  const [pending, setPending] = useState<Transition | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const actions = availableTransitions(task, user);

  const run = async (t: Transition, text: string) => {
    setBusy(true);
    const { error } = await supabase.rpc('change_task_status', {
      p_task_id: taskId,
      p_new_status: t.to,
      p_comment: text.trim() || null,
    });
    setBusy(false);
    if (error) {
      showError(error);
      setPending(null);
      onChanged(); // статус мог измениться у другого пользователя — перечитываем
      return;
    }
    showSuccess(`Статус: ${STATUS_LABEL[t.to]}`);
    setPending(null);
    onChanged();
  };

  const open = (t: Transition) => {
    setComment('');
    setPending(t);
  };

  if (actions.length === 0) return null;

  return (
    <>
      <Group gap="sm">
        {actions.map((t) => (
          <Button key={t.label} color={t.color} variant={t.variant} onClick={() => open(t)}>
            {t.label}
          </Button>
        ))}
      </Group>

      <Modal opened={pending !== null} onClose={() => setPending(null)} title={pending?.label}>
        {pending && (
          <Stack>
            <Text size="sm">
              Статус изменится на «{STATUS_LABEL[pending.to]}».
            </Text>
            <Textarea
              label="Комментарий"
              required={pending.commentRequired}
              description={pending.commentRequired ? 'Обязателен для этого действия' : 'Необязательно'}
              autosize
              minRows={3}
              value={comment}
              onChange={(e) => setComment(e.currentTarget.value)}
              data-autofocus
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setPending(null)}>Отмена</Button>
              <Button
                color={pending.color}
                loading={busy}
                disabled={pending.commentRequired && comment.trim() === ''}
                onClick={() => run(pending, comment)}
              >
                Подтвердить
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </>
  );
}
