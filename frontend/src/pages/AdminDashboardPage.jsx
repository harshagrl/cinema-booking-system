import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import api from '../services/api';
import { Shield, CheckCircle2, UserCheck, AlertCircle, RefreshCw, Key, Film, Building2 } from 'lucide-react';

export const AdminDashboardPage = () => {
  const { user } = useAuth();
  const [serverCheck, setServerCheck] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const verifyAdminAccess = () => {
    setLoading(true);
    setError(null);

    api.get('/auth/admin-check')
      .then((res) => {
        setServerCheck(res);
      })
      .catch((err) => {
        setError(err.message || 'Server rejected admin authorization');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    let isMounted = true;

    api.get('/auth/admin-check')
      .then((res) => {
        if (isMounted) setServerCheck(res);
      })
      .catch((err) => {
        if (isMounted) setError(err.message || 'Server rejected admin authorization');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Admin Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-950/60 border border-purple-800/80 flex items-center justify-center text-purple-400 shadow-lg shadow-purple-900/20">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                <span>Administrative Control Panel</span>
                <span className="text-xs uppercase font-extrabold tracking-wider px-2 py-0.5 rounded bg-purple-900/60 text-purple-300 border border-purple-700/50">
                  ADMIN ONLY
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Role-protected dashboard accessible only to authenticated cinema administrators
              </p>
            </div>
          </div>

          <button
            onClick={verifyAdminAccess}
            disabled={loading}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-xl border border-slate-700 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Re-verify Permissions</span>
          </button>
        </div>

        {/* Server-Side Verification Status Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Key className="w-4 h-4 text-amber-400" />
            <span>Server-Side Authorization Audit</span>
          </h2>

          {loading ? (
            <div className="p-4 bg-slate-950/60 rounded-xl text-center text-xs text-slate-400 animate-pulse">
              Verifying credentials with Express role middleware...
            </div>
          ) : error ? (
            <div className="p-4 bg-red-950/40 border border-red-800/50 rounded-xl flex items-start gap-3 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Backend Authorization Rejected:</p>
                <p>{error}</p>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-emerald-950/30 border border-emerald-800/40 rounded-xl flex items-start gap-3 text-xs text-emerald-300">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-sm text-emerald-200">
                  HTTP 200 OK — Backend Role Middleware Confirmed
                </p>
                <p className="text-emerald-400/90">
                  {serverCheck?.message || 'Admin authorization verified successfully.'}
                </p>
                <p className="text-[11px] font-mono text-emerald-500/80">
                  Endpoint: GET /api/auth/admin-check | Role: {user?.role} | User: {user?.email}
                </p>
              </div>
            </div>
          )}

          {/* Admin Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Logged In As</span>
              <span className="text-xs font-semibold text-slate-200 block mt-0.5">{user?.name}</span>
            </div>
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Admin Email</span>
              <span className="text-xs font-mono text-slate-300 block mt-0.5">{user?.email}</span>
            </div>
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">RBAC Enforcement</span>
              <span className="text-xs text-purple-400 font-semibold flex items-center gap-1 mt-0.5">
                <UserCheck className="w-3.5 h-3.5" />
                requireAdmin Guard Active
              </span>
            </div>
          </div>
        </div>

        {/* Quick Management Navigation Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            to="/admin/movies"
            className="p-5 bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-2xl transition-all group flex items-start gap-4 shadow-lg"
          >
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 group-hover:scale-105 transition-transform">
              <Film className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors">
                Movies &amp; Genres
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Catalogue management, genre taxonomies, runtime and rating configuration.
              </p>
            </div>
          </Link>

          <Link
            to="/admin/theatres"
            className="p-5 bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-2xl transition-all group flex items-start gap-4 shadow-lg"
          >
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 group-hover:scale-105 transition-transform">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors">
                Theatres &amp; Physical Seats
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Configure multiplex locations, auditoriums, seating layouts and category tiers.
              </p>
            </div>
          </Link>
        </div>

        {/* Next Phases Notice */}
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-5 text-xs text-slate-400 space-y-1">
          <p className="font-semibold text-slate-300">Upcoming Administrative Modules:</p>
          <p>
            Cinema hall and movie management functions (Phase 3 & 4), show scheduling (Phase 5), and financial reporting (Phase 11) will be integrated directly into this administrative layout.
          </p>
        </div>
      </div>
    </div>
  );
};
