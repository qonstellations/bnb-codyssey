import { Link } from "react-router-dom";
import { Button, Container, Group, Text, Title } from "@mantine/core";
import { useAuth } from "../auth/AuthContext.jsx";

function Landing() {
  const { user } = useAuth();

  return (
    <Container size="sm" my={80}>
      <Title ta="center">Web-Based Experiment Platform</Title>
      <Text ta="center" c="dimmed" mt="md">
        Build cognitive tasks, share a link, and watch millisecond-accurate results roll in.
      </Text>
      <Group justify="center" mt="xl">
        {user ? (
          <Button component={Link} to="/dashboard">
            Go to dashboard
          </Button>
        ) : (
          <>
            <Button component={Link} to="/signup">
              Sign up
            </Button>
            <Button variant="outline" component={Link} to="/login">
              Log in
            </Button>
          </>
        )}
      </Group>
    </Container>
  );
}

export default Landing;
