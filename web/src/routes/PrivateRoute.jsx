import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import LoadingScreen from "../components/LoadingScreen";

export default function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
