import { Button, Group, Modal, Select, Stack, TextInput, Textarea } from '@mantine/core';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { showError, showSuccess } from '../lib/errors';
import type { TaskRow } from '../lib/types';

interface Option {
  value: string;
  label: string;
}

/**
 * Создание задачи или правка её текста и объекта.
 * Исполнитель задаётся при создании; потом меняется только через «Сменить исполнителя».
 * Статус, автора и дату ставит база.
 */
export function TaskFormModal({
  opened,
  onClose,
  task,
  defaultObjectId,
  objectEditable,
  onSaved,
}: {
  opened: boolean;
  onClose: () => void;
  task?: TaskRow | null;
  defaultObjectId?: string;
  objectEditable: boolean;
  onSaved: (id: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [objectId, setObjectId] = useState<string | null>(null);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [objects, setObjects] = useState<Option[]>([]);
  const [executors, setExecutors] = useState<Option[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!opened) return;
    setTitle(task?.title ?? '');
    setDescription(task?.description ?? '');
    setObjectId(task?.object_id ?? defaultObjectId ?? null);
    setAssigneeId(task?.assignee_id ?? null);

    supabase
      .from('objects')
      .select('id, name')
      .order('name')
      .then(({ data }) => setObjects((data ?? []).map((o) => ({ value: o.id, label: o.name }))));
    if (!task) {
      supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'executor')
        .order('full_name')
        .then(({ data }) => setExecutors((data ?? []).map((p) => ({ value: p.id, label: p.full_name }))));
    }
  }, [opened, task, defaultObjectId]);

  const valid = title.trim() !== '' && objectId && (task || assigneeId);

  const save = async () => {
    setSaving(true);
    let result;
    if (task) {
      const values: Record<string, string> = { title: title.trim(), description: description.trim() };
      if (objectEditable && objectId && objectId !== task.object_id) values.object_id = objectId;
      result = await supabase.from('tasks').update(values).eq('id', task.id).select('id').single();
    } else {
      result = await supabase
        .from('tasks')
        .insert({ title: title.trim(), description: description.trim(), object_id: objectId, assignee_id: assigneeId })
        .select('id')
        .single();
    }
    setSaving(false);
    if (result.error) return showError(result.error);
    showSuccess(task ? 'Задача сохранена' : 'Задача создана');
    onSaved(result.data.id);
    onClose();
  };

  return (
    <Modal opened={opened} onClose={onClose} title={task ? 'Редактировать задачу' : 'Новая задача'} size="lg">
      <Stack>
        <TextInput label="Название" required value={title} onChange={(e) => setTitle(e.currentTarget.value)} data-autofocus />
        <Textarea label="Описание" autosize minRows={3} value={description} onChange={(e) => setDescription(e.currentTarget.value)} />
        <Select
          label="Объект"
          required
          data={objects}
          value={objectId}
          onChange={setObjectId}
          disabled={!objectEditable}
          description={task && !objectEditable ? 'Объект можно сменить только у задачи в статусе «Новая»' : undefined}
          searchable
        />
        {!task && (
          <Select
            label="Исполнитель"
            required
            data={executors}
            value={assigneeId}
            onChange={setAssigneeId}
            searchable
            nothingFoundMessage="Нет исполнителей"
          />
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Отмена</Button>
          <Button onClick={save} loading={saving} disabled={!valid}>Сохранить</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
