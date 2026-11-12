import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { Film, User, Shield, Clapperboard, Calendar, CheckCircle2 } from 'lucide-react';

export const HomePage = () => {
  const { user, isAuthenticated, isAdmin } = useAuth();

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Cinema Hero Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-amber-950/40 border border-slate-800 p-8 sm:p-12 shadow-2xl">
          <div className="relative z-10 max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold tracking-wide uppercase">
              <Film className="w-3.5 h-3.5" />
              <span>Full-Stack Assessment | Algions AI Labs</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              Cinema Hall Ticket Booking System
            </h1>
            <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
              A high-reliability, database-backed cinema reservation system featuring concurrency-safe seat locking, strict role authorization, and comprehensive ticket lifecycle management.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              {isAuthenticated ? (
                <>
                  {isAdmin && (
                    <Link
                      to="/admin"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs tracking-wide shadow-lg shadow-purple-600/20 transition-all cursor-pointer"
                    >
                      <Shield className="w-4 h-4" />
                      Open Admin Dashboard
                    </Link>
                  )}
                  <div className="text-xs text-slate-400 flex items-center gap-1.5 py-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Logged in as <strong>{user.name}</strong> ({user.role})</span>
                  </div>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs tracking-wide shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                  >
                    <span>Sign In to Your Account</span>
                  </Link>
                  <Link
                    to="/register"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-all cursor-pointer"
                  >
                    <span>Register New Account</span>
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Decorative ambient elements */}
          <div className="absolute right-0 top-0 -mt-10 -mr-10 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute right-8 bottom-8 opacity-10 hidden md:block">
            <Clapperboard className="w-48 h-48 text-amber-400" />
          </div>
        </div>

        {/* User Session Profile Card */}
        {isAuthenticated && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">{user.name}</h3>
                  <p className="text-xs text-slate-400">{user.email}</p>
                </div>
              </div>
              <span className="text-xs uppercase font-extrabold tracking-wider px-3 py-1 rounded-lg border bg-amber-950/60 text-amber-300 border-amber-700/50">
                {user.role}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">User ID</span>
                <span className="text-xs font-mono text-slate-300 truncate block mt-0.5">{user.id}</span>
              </div>
              <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Authentication</span>
                <span className="text-xs text-emerald-400 font-medium flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  HTTP-Only JWT Cookie
                </span>
              </div>
              <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Member Since</span>
                <span className="text-xs text-slate-300 font-medium flex items-center gap-1 mt-0.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {new Date(user.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Module Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <CheckCircle2 className="w-4 h-4" />
              <span>Phase 1 Completed: Database Foundation</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              PostgreSQL schema configured with 16 tables, dual partial unique indexes for active holds and active bookings, and 384 seeded ShowSeat records.
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <CheckCircle2 className="w-4 h-4" />
              <span>Phase 2 Completed: Authentication & RBAC</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Full authentication suite with customer registration, login, HTTP-only JWT cookies, rate limiting, and role-based access control guards (CUSTOMER, STAFF, ADMIN).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
