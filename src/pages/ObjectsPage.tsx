import { Badge, Button, Card, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { IconMapPin, IconPlus } from '@tabler/icons-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMe } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import { useLoad } from '../lib/useLoad';
import type { ObjectWithTasks } from '../lib/types';
import { DataState } from '../components/DataState';
import { ObjectFormModal } from '../components/ObjectFormModal';
import { StatusRail } from '../components/StatusRail';

export function ObjectsPage() {
  const me = useMe();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  // Что видно — решает RLS: исполнитель получит только объекты
  // со своими задачами и только свои задачи внутри них.
  const { data, error, loading, reload } = useLoad(async () => {
    const { data, error } = await supabase
      .from('objects')
      .select('id, name, address, created_at, updated_at, tasks(status)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as ObjectWithTasks[];
  }, []);

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={1}>Объекты</Title>
          <Text c="dimmed" size="sm" mt={4}>
            {me.role === 'manager' ? 'Все стройки компании' : 'Стройки, где у вас есть задачи'}
          </Text>
        </div>
        {me.role === 'manager' && (
          <Button leftSection={<IconPlus size={18} />} onClick={() => setCreating(true)}>
            Новый объект
          </Button>
        )}
      </Group>

      <DataState loading={loading} error={error} empty={!data} onRetry={reload}>
        {data && data.length === 0 && (
          <Card>
            <Text c="dimmed">
              {me.role === 'manager'
                ? 'Объектов пока нет. Создайте первый, чтобы ставить по нему задачи.'
                : 'Вам пока не назначено ни одной задачи.'}
            </Text>
          </Card>
        )}
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {data?.map((o) => {
            const review = o.tasks.filter((t) => t.status === 'review').length;
            return (
              <Card key={o.id} component={Link} to={`/objects/${o.id}`} className="card-link">
                <Stack gap="md" h="100%" justify="space-between">
                  <div>
                    <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
                      <Text fw={700} size="lg" lh={1.3}>{o.name}</Text>
                      {me.role === 'manager' && review > 0 && (
                        <Badge color="yellow" variant="filled" c="dark" style={{ flexShrink: 0 }}>
                          На проверке: {review}
                        </Badge>
                      )}
                    </Group>
                    <Group gap={6} mt={6} wrap="nowrap" align="flex-start">
                      <IconMapPin size={16} color="var(--steel)" style={{ flexShrink: 0, marginTop: 2 }} />
                      <Text size="sm" c="dimmed">{o.address}</Text>
                    </Group>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed" mb={6}>
                      {me.role === 'manager' ? 'Задачи' : 'Мои задачи'}: {o.tasks.length}
                    </Text>
                    <StatusRail statuses={o.tasks.map((t) => t.status)} />
                  </div>
                </Stack>
              </Card>
            );
          })}
        </SimpleGrid>
      </DataState>

      <ObjectFormModal
        opened={creating}
        onClose={() => setCreating(false)}
        onSaved={(id) => navigate(`/objects/${id}`)}
      />
    </Stack>
  );
}
