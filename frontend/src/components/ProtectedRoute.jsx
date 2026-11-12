import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { Film } from 'lucide-react';

export const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100">
        <Film className="w-12 h-12 text-amber-500 animate-spin mb-4" />
        <p className="text-slate-400 font-medium">Authenticating cinema session...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};
