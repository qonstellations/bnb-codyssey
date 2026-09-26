import { Link } from "react-router-dom";
import { Button, Container, Text, Title } from "@mantine/core";

function NotFound() {
  return (
    <Container size="sm" my={80}>
      <Title ta="center">404 — not found</Title>
      <Text ta="center" c="dimmed" mt="md">
        This page doesn&apos;t exist.
      </Text>
      <Button component={Link} to="/" display="block" mx="auto" mt="xl" w="fit-content">
        Go home
      </Button>
    </Container>
  );
}

export default NotFound;
