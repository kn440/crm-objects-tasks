import { Button, Group, Modal, Stack, TextInput } from '@mantine/core';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { showError, showSuccess } from '../lib/errors';
import type { ObjectRow } from '../lib/types';

/** Создание или редактирование объекта (только постановщик) */
export function ObjectFormModal({
  opened,
  onClose,
  object,
  onSaved,
}: {
  opened: boolean;
  onClose: () => void;
  object?: ObjectRow | null;
  onSaved: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (opened) {
      setName(object?.name ?? '');
      setAddress(object?.address ?? '');
    }
  }, [opened, object]);

  const valid = name.trim() !== '' && address.trim() !== '';

  const save = async () => {
    setSaving(true);
    const values = { name: name.trim(), address: address.trim() };
    const { data, error } = object
      ? await supabase.from('objects').update(values).eq('id', object.id).select('id').single()
      : await supabase.from('objects').insert(values).select('id').single();
    setSaving(false);
    if (error) return showError(error);
    showSuccess(object ? 'Объект сохранён' : 'Объект создан');
    onSaved(data.id);
    onClose();
  };

  return (
    <Modal opened={opened} onClose={onClose} title={object ? 'Редактировать объект' : 'Новый объект'}>
      <Stack>
        <TextInput label="Название" required value={name} onChange={(e) => setName(e.currentTarget.value)} data-autofocus />
        <TextInput label="Адрес" required value={address} onChange={(e) => setAddress(e.currentTarget.value)} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Отмена</Button>
          <Button onClick={save} loading={saving} disabled={!valid}>Сохранить</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
