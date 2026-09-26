import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Alert, Anchor, Button, Container, Paper, PasswordInput, TextInput, Title } from "@mantine/core";
import { useAuth, DEMO_CREDS } from "./AuthContext.jsx";

function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate(location.state?.from ?? "/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container size={420} my={60}>
      <Title ta="center">Welcome back</Title>
      <Paper withBorder shadow="sm" p={24} mt={24} radius="md">
        <form onSubmit={onSubmit}>
          <TextInput
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <PasswordInput
            label="Password"
            required
            mt="md"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {error && (
            <Alert color="red" mt="md">
              {error}
            </Alert>
          )}
          {DEMO_CREDS && (
            <Alert color="blue" mt="md">
              Demo login — email: <b>{DEMO_CREDS.email}</b> · password: <b>{DEMO_CREDS.password}</b>
            </Alert>
          )}
          <Button fullWidth mt="xl" type="submit" loading={submitting}>
            Log in
          </Button>
        </form>
      </Paper>
      <Anchor component={Link} to="/signup" display="block" ta="center" mt="md">
        No account? Sign up
      </Anchor>
    </Container>
  );
}

export default LoginPage;
