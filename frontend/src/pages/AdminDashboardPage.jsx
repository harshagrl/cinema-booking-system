import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { formatDate, formatTime } from '../utils/formatters';
import {
  Shield,
  AlertCircle,
  RefreshCw,
  Film,
  Building2,
  Calendar,
  Ticket,
  TrendingUp,
  RotateCcw,
  Clock,
  ArrowRight,
  ShieldAlert,
  Percent,
} from 'lucide-react';

export const AdminDashboardPage = () => {
  const [overview, setOverview] = useState(null);
  const [recentShows, setRecentShows] = useState([]);
  const [recentAuditLogs, setRecentAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get('/admin/reports/overview'),
      api.get('/admin/reports/shows?limit=5'),
      api.get('/admin/audit-logs?limit=6'),
    ])
      .then(([overviewRes, showsRes, auditRes]) => {
        if (overviewRes.success && overviewRes.data) {
          setOverview(overviewRes.data);
        }
        if (showsRes.success && showsRes.data) {
          setRecentShows(showsRes.data);
        }
        if (auditRes.success && auditRes.data) {
          setRecentAuditLogs(auditRes.data);
        }
      })
      .catch((err) => {
        setError(err.message || 'Failed to load administrative reports.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      api.get('/admin/reports/overview'),
      api.get('/admin/reports/shows?limit=5'),
      api.get('/admin/audit-logs?limit=6'),
    ])
      .then(([overviewRes, showsRes, auditRes]) => {
        if (isMounted) {
          if (overviewRes.success && overviewRes.data) {
            setOverview(overviewRes.data);
          }
          if (showsRes.success && showsRes.data) {
            setRecentShows(showsRes.data);
          }
          if (auditRes.success && auditRes.data) {
            setRecentAuditLogs(auditRes.data);
          }
        }
      })
      .catch((err) => {
        if (isMounted) setError(err.message || 'Failed to load administrative reports.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Admin Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-950/60 border border-purple-800/80 flex items-center justify-center text-purple-400 shadow-lg shadow-purple-900/20">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                <span>Administrative Analytics & Reports</span>
                <span className="text-xs uppercase font-extrabold tracking-wider px-2 py-0.5 rounded bg-purple-900/60 text-purple-300 border border-purple-700/50">
                  ADMIN ONLY
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time PostgreSQL aggregation of bookings, revenue, cancellations, show occupancy, and security logs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchDashboardData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-xs font-semibold rounded-xl border border-slate-800 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Reports</span>
            </button>
            <Link
              to="/admin/audit-logs"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-purple-950/80 hover:bg-purple-900 text-xs font-semibold text-purple-300 rounded-xl border border-purple-800/60 transition-all cursor-pointer"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
              <span>Audit Logs</span>
            </Link>
          </div>
        </div>

        {/* Quick Management Navigation Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link
            to="/admin/movies"
            className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/40 hover:bg-slate-900 transition-all flex items-center gap-3 group"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Film className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">Movies</span>
              <span className="text-[10px] text-slate-400">Manage catalog</span>
            </div>
          </Link>

          <Link
            to="/admin/theatres"
            className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/40 hover:bg-slate-900 transition-all flex items-center gap-3 group"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">Theatres & Screens</span>
              <span className="text-[10px] text-slate-400">Venues & layouts</span>
            </div>
          </Link>

          <Link
            to="/admin/shows"
            className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/40 hover:bg-slate-900 transition-all flex items-center gap-3 group"
          >
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">Showtimes</span>
              <span className="text-[10px] text-slate-400">Schedule screenings</span>
            </div>
          </Link>

          <Link
            to="/staff/ticket-validation"
            className="p-3.5 rounded-2xl bg-slate-900/80 border border-emerald-500/40 hover:bg-slate-900 transition-all flex items-center gap-3 group"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Ticket className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">Ticket Scanner</span>
              <span className="text-[10px] text-slate-400">Gate validation</span>
            </div>
          </Link>
        </div>

        {error && (
          <div className="p-4 bg-red-950/40 border border-red-800/50 rounded-2xl flex items-start gap-3 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Failed to fetch report data:</p>
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Executive KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Gross Revenue */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-bold uppercase tracking-wider text-[10px]">Gross Payments</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-white">
              ₹{overview?.revenue?.grossRevenue?.toFixed(2) || '0.00'}
            </div>
            <p className="text-[10px] text-slate-500">Total simulated payments captured</p>
          </div>

          {/* Total Refunds */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-bold uppercase tracking-wider text-[10px]">Total Refunded</span>
              <RotateCcw className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-black text-rose-400">
              ₹{overview?.revenue?.totalRefunds?.toFixed(2) || '0.00'}
            </div>
            <p className="text-[10px] text-slate-500">Issued via booking cancellations</p>
          </div>

          {/* Net Revenue */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-bold uppercase tracking-wider text-[10px]">Net Revenue</span>
              <TrendingUp className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-amber-400">
              ₹{overview?.revenue?.netRevenue?.toFixed(2) || '0.00'}
            </div>
            <p className="text-[10px] text-slate-500">Gross revenue minus refunds</p>
          </div>

          {/* Bookings & Cancellation Rate */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-bold uppercase tracking-wider text-[10px]">Bookings & Rate</span>
              <Percent className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-black text-white flex items-baseline gap-2">
              <span>{overview?.bookings?.confirmed || 0}</span>
              <span className="text-xs font-semibold text-slate-400">
                / {overview?.bookings?.total || 0} total
              </span>
            </div>
            <p className="text-[10px] text-slate-500">
              {overview?.bookings?.cancelled || 0} cancelled ({overview?.bookings?.cancellationRate || 0}%)
            </p>
          </div>
        </div>

        {/* Shows Occupancy Overview Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              <span>Show Occupancy & Performance</span>
            </h2>
            <Link
              to="/admin/shows"
              className="text-xs text-amber-400 hover:text-amber-300 font-semibold inline-flex items-center gap-1"
            >
              <span>Manage All Shows</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            {recentShows.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No active showtimes currently scheduled.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                    <tr>
                      <th className="py-3 px-4">Movie & Showtime</th>
                      <th className="py-3 px-4">Theatre & Screen</th>
                      <th className="py-3 px-4">Format</th>
                      <th className="py-3 px-4">Booked / Total Seats</th>
                      <th className="py-3 px-4">Occupancy</th>
                      <th className="py-3 px-4 text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {recentShows.map((s) => (
                      <tr key={s.showId} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-bold text-white block">{s.movie?.title}</span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {formatDate(s.startTime)} at {formatTime(s.startTime)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          <span className="font-semibold block">{s.theatre?.name}</span>
                          <span className="text-[11px] text-slate-500">{s.screenName}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            {s.screenFormat}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          <strong>{s.seats?.booked}</strong> / {s.seats?.total}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-amber-500 h-full rounded-full"
                                style={{ width: `${Math.min(100, s.seats?.occupancyPercentage || 0)}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-bold text-slate-300">
                              {s.seats?.occupancyPercentage}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-amber-400 font-mono">
                          ₹{s.revenue?.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Recent Audit Activity Stream */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-purple-400" />
              <span>Recent Operational Audit Events</span>
            </h2>
            <Link
              to="/admin/audit-logs"
              className="text-xs text-purple-400 hover:text-purple-300 font-semibold inline-flex items-center gap-1"
            >
              <span>View Full Audit Log</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl divide-y divide-slate-800/60 overflow-hidden shadow-xl text-xs">
            {recentAuditLogs.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No recent audit activity recorded.
              </div>
            ) : (
              recentAuditLogs.map((log) => (
                <div key={log.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                      {log.action}
                    </span>
                    <div>
                      <span className="font-semibold text-slate-200 text-[11px] block">
                        {log.entityType} ({log.entityId ? `${log.entityId.slice(0, 8)}...` : 'N/A'})
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Actor: {log.actor ? `${log.actor.name} (${log.actor.role})` : 'System'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-slate-400 text-[11px]">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>{formatDate(log.createdAt)} {formatTime(log.createdAt)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
