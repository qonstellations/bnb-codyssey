import { useNavigate } from "react-router-dom";
import {
  Avatar,
  Button,
  Container,
  CopyButton,
  Divider,
  Group,
  Paper,
  Stack,
  Text,
  Title,
  Tooltip,
  ActionIcon,
} from "@mantine/core";
import { useAuth } from "../auth/AuthContext.jsx";

function initials(name, email) {
  const src = name || email || "?";
  return src
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function Account() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <Container size="xs" my="xl">
      <Title order={2}>Account</Title>
      <Paper withBorder shadow="sm" p="xl" mt="md" radius="md">
        <Group>
          <Avatar size="lg" radius="xl" color="teal">
            {initials(user?.name, user?.email)}
          </Avatar>
          <Stack gap={2}>
            <Text fw={600} size="lg">
              {user?.name ?? "Researcher"}
            </Text>
            <Text c="dimmed" size="sm">
              {user?.email}
            </Text>
          </Stack>
        </Group>

        <Divider my="md" />

        <Stack gap="xs">
          <Group justify="space-between">
            <Text c="dimmed" size="sm">
              User ID
            </Text>
            <Group gap="xs">
              <Text size="sm" ff="monospace">
                {user?.id ?? "—"}
              </Text>
              {user?.id && (
                <CopyButton value={user.id}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? "Copied" : "Copy"}>
                      <ActionIcon variant="subtle" onClick={copy} aria-label="Copy user ID">
                        {copied ? "✓" : "⧉"}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              )}
            </Group>
          </Group>
          <Group justify="space-between">
            <Text c="dimmed" size="sm">
              Role
            </Text>
            <Text size="sm">Researcher</Text>
          </Group>
        </Stack>

        <Divider my="md" />

        <Group justify="flex-end">
          <Button variant="outline" color="red" onClick={onLogout}>
            Log out
          </Button>
        </Group>
      </Paper>
    </Container>
  );
}

export default Account;
