import { Alert, Box, Button, Center, Group, Paper, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { IconBuildingSkyscraper } from '@tabler/icons-react';
import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { errorText } from '../lib/errors';

export function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Center mih="100vh" p="md">
      <Paper withBorder w="100%" maw={400} style={{ overflow: 'hidden' }}>
        <div className="hazard-tape" />
        <Box p={{ base: 'lg', sm: 'xl' }}>
          <form onSubmit={submit}>
            <Stack gap="md">
              <Group gap="sm" wrap="nowrap">
                <Box w={40} h={40} bg="dark.8" style={{ borderRadius: 8, display: 'grid', placeItems: 'center' }}>
                  <IconBuildingSkyscraper size={23} color="#f5b301" stroke={1.8} />
                </Box>
                <div>
                  <Title order={3}>Объекты и задачи</Title>
                  <Text size="sm" c="dimmed">Задачи по стройкам компании</Text>
                </div>
              </Group>
              <TextInput label="Email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
              <PasswordInput label="Пароль" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.currentTarget.value)} />
              {error && <Alert color="red" variant="light" py="xs">{error}</Alert>}
              <Button type="submit" loading={busy} size="md" mt={4}>Войти</Button>
              <Text size="xs" c="dimmed">Регистрации нет: учётную запись выдаёт администратор.</Text>
            </Stack>
          </form>
        </Box>
      </Paper>
    </Center>
  );
}
