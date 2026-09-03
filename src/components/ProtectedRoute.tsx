import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import type { Role } from "../types";

export default function ProtectedRoute({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  const { profile, loading } = useAuth();

  if (loading) return <p className="text-sm text-stone text-center py-16">Loading...</p>;
  if (!profile) return <Navigate to="/login" replace />;
  if (profile.role !== role) {
    return <Navigate to={profile.role === "vendor" ? "/vendor" : "/buyer"} replace />;
  }
  return <>{children}</>;
}
