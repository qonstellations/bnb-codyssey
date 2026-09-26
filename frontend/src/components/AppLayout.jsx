import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Menu, UnstyledButton } from "@mantine/core";
import { useAuth } from "../auth/AuthContext.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import "../landing.css";

function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="ag ag-app">
      <header className="ag-nav ag-appbar">
        <Link to="/" className="ag-brand">
          Codyssey
        </Link>
        <nav className="ag-tabs">
          <NavLink to="/dashboard" className="ag-tab">
            Experiments
          </NavLink>
          <NavLink to="/account" className="ag-tab">
            Account
          </NavLink>
        </nav>
        <ThemeToggle />
        <Menu position="bottom-end">
          <Menu.Target>
            <UnstyledButton className="ag-pill ghost ag-pill-sm">
              {user?.name ?? user?.email ?? "Account"}
            </UnstyledButton>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>{user?.email}</Menu.Label>
            <Menu.Item component={Link} to="/account">
              Account
            </Menu.Item>
            <Menu.Item onClick={onLogout}>Log out</Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </header>
      <main className="ag-app-main">
        <Outlet />
      </main>
    </div>
  );
}

export default AppLayout;
