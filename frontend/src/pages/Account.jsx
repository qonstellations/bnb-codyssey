import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { notifications } from "@mantine/notifications";
import {
  Avatar,
  Button,
  Container,
  CopyButton,
  Divider,
  Group,
  Modal,
  Paper,
  PasswordInput,
  Stack,
  Text,
  Title,
  Tooltip,
  ActionIcon,
} from "@mantine/core";
import { useAuth } from "../auth/AuthContext.jsx";
import { deleteAccount } from "../api/auth.js";

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

  const [deleting, setDeleting] = useState(null); // { password, busy } while the dialog is open

  const onLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const onDelete = async () => {
    setDeleting((d) => ({ ...d, busy: true }));
    try {
      await deleteAccount(deleting.password);
      await logout();
      notifications.show({ message: "Your account and all its data were deleted" });
      navigate("/", { replace: true });
    } catch (err) {
      notifications.show({ color: "red", message: err.message ?? "Could not delete account" });
      setDeleting((d) => d && { ...d, busy: false });
    }
  };

  return (
    <Container size="xs" my="xl">
      <Title order={1} style={{ letterSpacing: "-0.04em" }}>Account</Title>
      <Paper withBorder shadow="sm" p="xl" mt="md" radius="md">
        <Group>
          <Avatar size="lg" radius="xl" color="blue">
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
                {user?._id ?? "—"}
              </Text>
              {user?._id && (
                <CopyButton value={String(user._id)}>
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

        <Group justify="space-between">
          <Button variant="subtle" color="red" onClick={() => setDeleting({ password: "", busy: false })}>
            Delete account
          </Button>
          <Button variant="outline" color="red" onClick={onLogout}>
            Log out
          </Button>
        </Group>
      </Paper>

      <Modal opened={!!deleting} onClose={() => setDeleting(null)} title="Delete your account?">
        {deleting && (
          <Stack>
            <Text size="sm">
              This permanently deletes your account, every experiment, all participant data and your uploaded
              stimuli. It cannot be undone.
            </Text>
            <PasswordInput
              label="Confirm with your password"
              value={deleting.password}
              onChange={(e) => {
                const password = e.currentTarget.value;
                setDeleting((d) => ({ ...d, password }));
              }}
              data-autofocus
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setDeleting(null)}>
                Cancel
              </Button>
              <Button color="red" loading={deleting.busy} disabled={!deleting.password} onClick={onDelete}>
                Delete everything
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Container>
  );
}

export default Account;
