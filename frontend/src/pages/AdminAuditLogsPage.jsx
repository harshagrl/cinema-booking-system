import { useState, useEffect } from 'react';
import api from '../services/api';
import { formatDate, formatTime } from '../utils/formatters';
import {
  ShieldAlert,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  User,
  Activity,
  Code2,
  X,
  AlertCircle,
  Clock,
} from 'lucide-react';

export const AdminAuditLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [selectedAction, setSelectedAction] = useState('');
  const [selectedEntity, setSelectedEntity] = useState('');
  const [selectedLogDetails, setSelectedLogDetails] = useState(null);

  const fetchLogs = (pageToFetch = 1) => {
    setLoading(true);
    setError(null);
    const queryParams = new URLSearchParams();
    queryParams.set('page', pageToFetch.toString());
    queryParams.set('limit', '20');
    if (selectedAction) queryParams.set('action', selectedAction);
    if (selectedEntity) queryParams.set('entityType', selectedEntity);

    api.get(`/admin/audit-logs?${queryParams.toString()}`)
      .then((res) => {
        if (res.success && res.data) {
          setLogs(res.data);
          if (res.pagination) {
            setPagination(res.pagination);
          }
        }
      })
      .catch((err) => {
        setError(err.message || 'Failed to fetch audit logs.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    let isMounted = true;
    const queryParams = new URLSearchParams();
    queryParams.set('page', '1');
    queryParams.set('limit', '20');
    if (selectedAction) queryParams.set('action', selectedAction);
    if (selectedEntity) queryParams.set('entityType', selectedEntity);

    api.get(`/admin/audit-logs?${queryParams.toString()}`)
      .then((res) => {
        if (isMounted && res.success && res.data) {
          setLogs(res.data);
          if (res.pagination) {
            setPagination(res.pagination);
          }
        }
      })
      .catch((err) => {
        if (isMounted) setError(err.message || 'Failed to fetch audit logs.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedAction, selectedEntity]);

  const getActionBadge = (action) => {
    switch (action) {
      case 'BOOKING_CANCELLED':
        return 'bg-red-950/80 text-red-400 border-red-800/80';
      case 'REFUND_PROCESSED':
        return 'bg-rose-950/80 text-rose-300 border-rose-800/80';
      case 'TICKET_VALIDATED':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80';
      case 'TICKET_VALIDATION_FAILED':
        return 'bg-amber-950/80 text-amber-300 border-amber-800/80';
      case 'SHOW_CREATED':
      case 'SHOW_UPDATED':
      case 'SHOW_STATUS_CHANGED':
        return 'bg-purple-950/80 text-purple-300 border-purple-800/80';
      case 'MOVIE_CREATED':
      case 'MOVIE_UPDATED':
      case 'MOVIE_STATUS_CHANGED':
        return 'bg-blue-950/80 text-blue-300 border-blue-800/80';
      case 'THEATRE_CREATED':
      case 'THEATRE_UPDATED':
      case 'THEATRE_STATUS_CHANGED':
        return 'bg-cyan-950/80 text-cyan-300 border-cyan-800/80';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-900/60 text-purple-300 border-purple-700/50';
      case 'STAFF':
        return 'bg-blue-900/60 text-blue-300 border-blue-700/50';
      default:
        return 'bg-amber-900/60 text-amber-300 border-amber-700/50';
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-950/60 border border-purple-800/80 flex items-center justify-center text-purple-400 shadow-lg shadow-purple-900/20">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                <span>Audit Logs & Security Trail</span>
                <span className="text-xs uppercase font-extrabold tracking-wider px-2 py-0.5 rounded bg-purple-900/60 text-purple-300 border border-purple-700/50">
                  ADMIN ONLY
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Immutable record of administrative mutations, cancellations, simulated refunds, and ticket admissions
              </p>
            </div>
          </div>

          <button
            onClick={() => fetchLogs(pagination.page)}
            disabled={loading}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-xs font-semibold rounded-xl border border-slate-800 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Logs</span>
          </button>
        </div>

        {/* Filter Controls */}
        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <Filter className="w-4 h-4 text-amber-500" />
            <span className="font-semibold uppercase tracking-wider text-[11px]">Filters:</span>
          </div>

          {/* Action Filter */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Action:</span>
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-amber-500"
            >
              <option value="">All Actions</option>
              <option value="BOOKING_CANCELLED">BOOKING_CANCELLED</option>
              <option value="REFUND_PROCESSED">REFUND_PROCESSED</option>
              <option value="TICKET_VALIDATED">TICKET_VALIDATED</option>
              <option value="SHOW_CREATED">SHOW_CREATED</option>
              <option value="SHOW_UPDATED">SHOW_UPDATED</option>
              <option value="SHOW_STATUS_CHANGED">SHOW_STATUS_CHANGED</option>
              <option value="MOVIE_CREATED">MOVIE_CREATED</option>
              <option value="MOVIE_UPDATED">MOVIE_UPDATED</option>
              <option value="MOVIE_STATUS_CHANGED">MOVIE_STATUS_CHANGED</option>
              <option value="THEATRE_CREATED">THEATRE_CREATED</option>
              <option value="THEATRE_UPDATED">THEATRE_UPDATED</option>
              <option value="THEATRE_STATUS_CHANGED">THEATRE_STATUS_CHANGED</option>
            </select>
          </div>

          {/* Entity Filter */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Entity Type:</span>
            <select
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-amber-500"
            >
              <option value="">All Entities</option>
              <option value="BOOKING">BOOKING</option>
              <option value="REFUND">REFUND</option>
              <option value="TICKET">TICKET</option>
              <option value="SHOW">SHOW</option>
              <option value="MOVIE">MOVIE</option>
              <option value="THEATRE">THEATRE</option>
            </select>
          </div>

          {(selectedAction || selectedEntity) && (
            <button
              onClick={() => {
                setSelectedAction('');
                setSelectedEntity('');
              }}
              className="px-2.5 py-1 text-slate-400 hover:text-white text-[11px] font-semibold transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          )}

          <div className="ml-auto text-slate-400 text-[11px]">
            Found <strong>{pagination.total}</strong> recorded event(s)
          </div>
        </div>

        {/* Audit Logs Table */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-3">
              <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
              <p className="text-xs text-slate-400">Retrieving audit activity from database...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
              <p className="text-sm font-bold text-red-300">{error}</p>
              <button
                onClick={() => fetchLogs(pagination.page)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <Activity className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-300">No audit logs matching criteria</p>
              <p className="text-xs text-slate-500">Audit logs are recorded automatically as actions occur.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Entity</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* Timestamp */}
                      <td className="py-3 px-4 whitespace-nowrap text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span>{formatDate(log.createdAt)}</span>
                          <span className="text-slate-500 font-mono text-[11px]">
                            {formatTime(log.createdAt)}
                          </span>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border uppercase tracking-wider ${getActionBadge(
                            log.action
                          )}`}
                        >
                          {log.action}
                        </span>
                      </td>

                      {/* Entity */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-300 text-[11px]">{log.entityType}</span>
                          {log.entityId && (
                            <span className="font-mono text-[10px] text-slate-500">
                              ({log.entityId.slice(0, 8)}...)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actor */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {log.actor ? (
                          <div className="flex items-center gap-2">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <div>
                              <span className="font-semibold text-slate-200 block text-[11px]">
                                {log.actor.name}
                              </span>
                              <span className="text-[10px] text-slate-500 block">
                                {log.actor.email}
                              </span>
                            </div>
                            <span
                              className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border ${getRoleBadge(
                                log.actor.role
                              )}`}
                            >
                              {log.actor.role}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic text-[11px]">System / Anonymous</span>
                        )}
                      </td>

                      {/* Details / Modal Trigger */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => setSelectedLogDetails(log)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-semibold inline-flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <Code2 className="w-3 h-3 text-amber-400" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>
              Page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong>
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchLogs(pagination.page - 1)}
                disabled={pagination.page <= 1 || loading}
                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
              <button
                onClick={() => fetchLogs(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages || loading}
                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1 cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Metadata Inspection Modal */}
        {selectedLogDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl relative my-8 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Audit Event Payload: {selectedLogDetails.action}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedLogDetails(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Entity: {selectedLogDetails.entityType}</span>
                  <span className="font-mono text-[10px] text-slate-500">ID: {selectedLogDetails.entityId || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Actor: {selectedLogDetails.actor?.name || 'System'}</span>
                  <span>{formatDate(selectedLogDetails.createdAt)} at {formatTime(selectedLogDetails.createdAt)}</span>
                </div>
              </div>

              {/* JSON Payload Display */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-emerald-400 overflow-x-auto max-h-72 scrollbar-thin">
                <pre>{JSON.stringify(selectedLogDetails.metadata || {}, null, 2)}</pre>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setSelectedLogDetails(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
