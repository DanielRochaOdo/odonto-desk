import { Navigate, Route, Routes } from "react-router-dom";
import PrivateRoute from "./routes/PrivateRoute";
import AgentSession from "./pages/AgentSession";
import ClientSession from "./pages/ClientSession";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import SessionRoom from "./pages/SessionRoom";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/app"
        element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        }
      />
      <Route
        path="/app/client"
        element={
          <PrivateRoute>
            <ClientSession />
          </PrivateRoute>
        }
      />
      <Route
        path="/app/agent"
        element={
          <PrivateRoute>
            <AgentSession />
          </PrivateRoute>
        }
      />
      <Route
        path="/app/session/:id"
        element={
          <PrivateRoute>
            <SessionRoom />
          </PrivateRoute>
        }
      />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}
