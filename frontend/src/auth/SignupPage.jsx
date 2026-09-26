import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Alert, PasswordInput, TextInput } from "@mantine/core";
import { useAuth } from "./AuthContext.jsx";
import AgShell from "../components/AgShell.jsx";

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
    <AgShell
      navRight={
        <Link to="/" className="ag-pill ghost">
          ← Back to home
        </Link>
      }
    >
      <main className="ag-auth">
        <h1 className="ag-auth-title ag-split">Create an account</h1>
        <div className="ag-card ag-auth-card ag-reveal">
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
            <button type="submit" className="ag-pill" style={{ marginTop: 28 }} disabled={submitting}>
              {submitting ? "…" : "Sign up"}
            </button>
          </form>
        </div>
        <p className="ag-auth-alt ag-reveal">
          Have an account? <Link to="/login">Log in</Link>
        </p>
      </main>
    </AgShell>
  );
}

export default SignupPage;
