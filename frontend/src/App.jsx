import { Routes, Route } from "react-router-dom";
import ProtectedRoute from "./auth/ProtectedRoute.jsx";
import AppLayout from "./components/AppLayout.jsx";
import Landing from "./pages/Landing.jsx";
import LoginPage from "./auth/LoginPage.jsx";
import SignupPage from "./auth/SignupPage.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Account from "./pages/Account.jsx";
import BuilderPage from "./pages/BuilderPage.jsx";
import ResultsPage from "./pages/ResultsPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import NotFound from "./pages/NotFound.jsx";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/account" element={<Account />} />
          <Route path="/experiments/:id/edit" element={<BuilderPage />} />
          <Route path="/experiments/:id/results" element={<ResultsPage />} />
          <Route path="/experiments/:id/settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
