import { Link, useNavigate } from "react-router-dom";
import { AppShell, Burger, Button, Group, Menu, Text, UnstyledButton } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";

function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure(false);

  const onLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 220, breakpoint: "sm", collapsed: { mobile: !mobileOpened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={mobileOpened} onClick={toggleMobile} hiddenFrom="sm" size="sm" />
            <UnstyledButton component={Link} to="/dashboard">
              <Text fw={700} size="lg">
                Codyssey
              </Text>
            </UnstyledButton>
          </Group>
          <Menu position="bottom-end">
            <Menu.Target>
              <Button variant="subtle">{user?.name ?? user?.email ?? "Account"}</Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>{user?.email}</Menu.Label>
              <Menu.Item onClick={onLogout}>Log out</Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <Button variant="subtle" fullWidth justify="flex-start" component={Link} to="/dashboard">
          Dashboard
        </Button>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}

export default AppLayout;
