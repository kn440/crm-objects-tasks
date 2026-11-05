import { Avatar, Box, Button, Container, Group, Menu, Text, UnstyledButton } from '@mantine/core';
import { IconBuildingSkyscraper, IconChevronDown, IconListCheck, IconLogout } from '@tabler/icons-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth, useMe } from '../auth/AuthContext';
import { ROLE_LABEL } from '../domain/transitions';

const initials = (name: string) =>
  name
    .replace(/\(.*\)/, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

export function Layout() {
  const me = useMe();
  const { signOut } = useAuth();

  const link = (to: string, label: string, icon: React.ReactNode) => (
    <NavLink to={to} style={{ textDecoration: 'none' }}>
      {({ isActive }) => (
        <Button
          variant={isActive ? 'light' : 'subtle'}
          color={isActive ? 'blueprint' : 'gray'}
          size="sm"
          leftSection={icon}
          px={{ base: 8, sm: 12 }}
        >
          {label}
        </Button>
      )}
    </NavLink>
  );

  return (
    <Box mih="100vh">
      <Box component="header" bg="white" style={{ borderBottom: '1px solid var(--line)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div className="hazard-tape" />
        <Container size="lg" h={60}>
          <Group h="100%" justify="space-between" wrap="nowrap" gap="xs">
            <Group gap={4} wrap="nowrap">
              <Group gap={8} mr={{ base: 4, sm: 20 }} wrap="nowrap">
                <Box
                  w={32}
                  h={32}
                  bg="dark.8"
                  style={{ borderRadius: 6, display: 'grid', placeItems: 'center', flexShrink: 0 }}
                >
                  <IconBuildingSkyscraper size={19} color="#f5b301" stroke={1.8} />
                </Box>
                <Text fw={700} visibleFrom="md">Объекты и задачи</Text>
              </Group>
              {me.role === 'executor' && link('/my-tasks', 'Мои задачи', <IconListCheck size={17} />)}
              {link('/objects', 'Объекты', <IconBuildingSkyscraper size={17} />)}
            </Group>

            <Menu position="bottom-end" width={220} shadow="md">
              <Menu.Target>
                <UnstyledButton aria-label="Профиль">
                  <Group gap={10} wrap="nowrap">
                    <Box visibleFrom="sm" ta="right">
                      <Text size="sm" fw={600} lh={1.2}>{me.full_name.replace(/\s*\(.*\)/, '')}</Text>
                      <Text size="xs" c="dimmed" lh={1.2}>{ROLE_LABEL[me.role]}</Text>
                    </Box>
                    <Avatar color={me.role === 'manager' ? 'violet' : 'teal'} radius="xl" size={34}>
                      {initials(me.full_name)}
                    </Avatar>
                    <IconChevronDown size={14} color="var(--steel)" />
                  </Group>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Box px="sm" py={6}>
                  <Text size="sm" fw={600}>{me.full_name.replace(/\s*\(.*\)/, '')}</Text>
                  <Text size="xs" c="dimmed">{ROLE_LABEL[me.role]}</Text>
                </Box>
                <Menu.Divider />
                <Menu.Item leftSection={<IconLogout size={16} />} onClick={signOut}>
                  Выйти
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Container>
      </Box>
      <Container size="lg" py={{ base: 'md', sm: 'xl' }} px={{ base: 'sm', sm: 'md' }}>
        <Outlet />
      </Container>
    </Box>
  );
}
