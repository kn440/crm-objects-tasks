import { Alert, Button, Center, Container, Loader, Stack, Text } from '@mantine/core';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { supabaseConfigured } from './lib/supabase';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { ObjectsPage } from './pages/ObjectsPage';
import { ObjectPage } from './pages/ObjectPage';
import { TaskPage } from './pages/TaskPage';
import { MyTasksPage } from './pages/MyTasksPage';

export function App() {
  const { session, profile, profileMissing, loading, signOut } = useAuth();

  if (!supabaseConfigured) {
    return (
      <Container size="sm" py="xl">
        <Alert color="red" title="Не настроено подключение к Supabase">
          Заполните VITE_SUPABASE_URL и VITE_SUPABASE_PUBLISHABLE_KEY в файле .env (см. .env.example).
        </Alert>
      </Container>
    );
  }

  if (loading) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (!profile) {
    return (
      <Container size="sm" py="xl">
        <Stack>
          <Alert color="orange" title="Профиль не настроен">
            {profileMissing
              ? 'Для этой учётной записи не назначена роль. Обратитесь к администратору.'
              : 'Не удалось загрузить профиль. Обновите страницу.'}
          </Alert>
          <Text size="sm" c="dimmed">{session.user.email}</Text>
          <Button variant="light" onClick={signOut} w="fit-content">Выйти</Button>
        </Stack>
      </Container>
    );
  }

  const home = profile.role === 'executor' ? '/my-tasks' : '/objects';

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/objects" element={<ObjectsPage />} />
        <Route path="/objects/:id" element={<ObjectPage />} />
        <Route path="/tasks/:id" element={<TaskPage />} />
        <Route
          path="/my-tasks"
          element={profile.role === 'executor' ? <MyTasksPage /> : <Navigate to="/objects" replace />}
        />
        <Route path="*" element={<Navigate to={home} replace />} />
      </Route>
    </Routes>
  );
}
