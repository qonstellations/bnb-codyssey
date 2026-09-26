import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Alert, Anchor, Button, Container, Paper, PasswordInput, TextInput, Title } from "@mantine/core";
import { useAuth } from "./AuthContext.jsx";

function SignupPage() {
  const { user, signup } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
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
      await signup(name.trim(), email.trim(), password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Signup failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container size={420} my={60}>
      <Title ta="center">Create an account</Title>
      <Paper withBorder shadow="sm" p={24} mt={24} radius="md">
        <form onSubmit={onSubmit}>
          <TextInput
            label="Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
          <TextInput
            label="Email"
            type="email"
            required
            mt="md"
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
            autoComplete="new-password"
          />
          {error && (
            <Alert color="red" mt="md">
              {error}
            </Alert>
          )}
          <Button fullWidth mt="xl" type="submit" loading={submitting}>
            Sign up
          </Button>
        </form>
      </Paper>
      <Anchor component={Link} to="/login" display="block" ta="center" mt="md">
        Have an account? Log in
      </Anchor>
    </Container>
  );
}

export default SignupPage;
