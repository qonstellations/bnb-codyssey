import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Alert, PasswordInput, TextInput } from "@mantine/core";
import { useAuth, DEMO_CREDS } from "./AuthContext.jsx";
import AgShell from "../components/AgShell.jsx";

function LoginPage() {
  const { user, login, continueAsGuest } = useAuth();
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
    <AgShell
      navRight={
        <Link to="/" className="ag-pill ghost">
          ← Back to home
        </Link>
      }
    >
      <main className="ag-auth">
        <h1 className="ag-auth-title ag-split">Welcome back</h1>
        <div className="ag-card ag-auth-card ag-reveal">
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
            <button type="submit" className="ag-pill" style={{ marginTop: 28 }} disabled={submitting}>
              {submitting ? "…" : "Log in"}
            </button>
          </form>
            <button
              type="button"
              className="ag-pill ghost"
              style={{ marginTop: 12 }}
              onClick={() => {
                continueAsGuest();
                navigate("/dashboard", { replace: true });
              }}
            >
              Continue as guest
            </button>
        </div>
        <p className="ag-auth-alt ag-reveal">
          No account? <Link to="/signup">Sign up</Link>
        </p>
      </main>
    </AgShell>
  );
}

export default LoginPage;
