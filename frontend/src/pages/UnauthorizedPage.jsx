import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export const UnauthorizedPage = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-950 text-slate-100">
      <div className="max-w-md w-full text-center space-y-6 bg-slate-900/90 border border-slate-800 p-8 rounded-3xl shadow-2xl">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-950/50 border border-red-800/60 text-red-400">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            403 — Access Denied
          </h1>
          <p className="mt-2 text-xs text-slate-400 leading-relaxed">
            You do not have the required administrative permissions to access this page.
            Your current role is{' '}
            <span className="font-bold text-amber-400 uppercase">
              {user?.role || 'ANONYMOUS'}
            </span>
            .
          </p>
        </div>

        <div className="pt-2">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-xl border border-slate-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Cinema Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
