import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  formatDuration,
  formatDate,
  formatTime,
  FALLBACK_POSTER,
} from '../utils/formatters';
import {
  Ticket,
  Clock,
  Building2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  CreditCard,
  RefreshCw,
  ArrowRight,
  Film,
  Copy,
  Check,
  QrCode,
  Printer,
  X,
  Sparkles,
  RotateCcw,
  Ban,
  ShieldAlert,
} from 'lucide-react';

export const MyBookingsPage = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [copiedRef, setCopiedRef] = useState(null);

  // Digital Ticket Modal State
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  // Booking Cancellation State
  const [cancellingBooking, setCancellingBooking] = useState(null);
  const [cancelReason, setCancelReason] = useState('Change of schedule / plans');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState(null);
  const [cancelSuccessMsg, setCancelSuccessMsg] = useState(null);

  // Fetch bookings on initial mount
  useEffect(() => {
    let isMounted = true;

    api.get('/bookings?limit=50')
      .then((res) => {
        if (isMounted && res.success && res.data) {
          setBookings(res.data.bookings || []);
        }
      })
      .catch((err) => {
        if (isMounted) setError(err.message || 'Failed to load bookings.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Manual refresh handler
  const fetchBookings = () => {
    setLoading(true);
    setError(null);
    api.get('/bookings?limit=50')
      .then((res) => {
        if (res.success && res.data) {
          setBookings(res.data.bookings || []);
        }
      })
      .catch((err) => {
        setError(err.message || 'Failed to load bookings.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  // Open digital ticket details modal
  const handleViewTicket = async (ticketId) => {
    setTicketLoading(true);
    setSelectedTicket(null);
    setCopiedToken(false);
    try {
      const res = await api.get(`/tickets/${ticketId}`);
      if (res.success && res.data) {
        setSelectedTicket(res.data);
      }
    } catch (err) {
      alert(err.message || 'Failed to load ticket details.');
    } finally {
      setTicketLoading(false);
    }
  };

  // Copy booking reference
  const handleCopyRef = (ref) => {
    navigator.clipboard?.writeText(ref);
    setCopiedRef(ref);
    setTimeout(() => setCopiedRef(null), 2000);
  };

  // Copy verification token
  const handleCopyToken = (token) => {
    navigator.clipboard?.writeText(token);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  // Submit booking cancellation request
  const handleConfirmCancel = async () => {
    if (!cancellingBooking) return;
    setCancelLoading(true);
    setCancelError(null);
    try {
      const res = await api.post(`/bookings/${cancellingBooking.id}/cancel`, {
        reason: cancelReason,
      });
      if (res.success && res.data?.booking) {
        setBookings((prev) =>
          prev.map((b) => (b.id === cancellingBooking.id ? res.data.booking : b))
        );
        const refundAmt = res.data.refund?.amount
          ? `₹${Number(res.data.refund.amount).toFixed(2)}`
          : 'Full amount';
        setCancelSuccessMsg(
          `Booking ${cancellingBooking.bookingReference} has been successfully cancelled. ${refundAmt} has been refunded to your simulated payment method.`
        );
        setCancellingBooking(null);
        setTimeout(() => setCancelSuccessMsg(null), 8000);
      }
    } catch (err) {
      setCancelError(err.message || 'Failed to cancel booking.');
    } finally {
      setCancelLoading(false);
    }
  };

  // Filter bookings based on activeTab
  const now = new Date();
  const filteredBookings = bookings.filter((b) => {
    if (activeTab === 'all') return true;

    if (activeTab === 'upcoming') {
      const showStart = b.show?.startTime ? new Date(b.show.startTime) : null;
      return b.status === 'CONFIRMED' && showStart && showStart >= now;
    }

    if (activeTab === 'past') {
      const showStart = b.show?.startTime ? new Date(b.show.startTime) : null;
      return b.status === 'CONFIRMED' && showStart && showStart < now;
    }

    if (activeTab === 'pending') {
      return b.status === 'PENDING_PAYMENT' || b.status === 'PENDING';
    }

    if (activeTab === 'cancelled') {
      return b.status === 'CANCELLED';
    }

    if (activeTab === 'failed') {
      return (
        b.status === 'EXPIRED' ||
        b.latestPayment?.status === 'FAILED'
      );
    }

    return true;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'CONFIRMED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 shadow-sm shadow-emerald-950/50">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Confirmed</span>
          </span>
        );
      case 'PENDING_PAYMENT':
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-950/80 text-amber-300 border border-amber-800/80 animate-pulse">
            <Clock className="w-3.5 h-3.5" />
            <span>Pending Payment</span>
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-zinc-900 text-zinc-400 border border-zinc-800">
            <XCircle className="w-3.5 h-3.5" />
            <span>Hold Expired</span>
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-950/80 text-red-400 border border-red-800/80">
            <XCircle className="w-3.5 h-3.5" />
            <span>Cancelled</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 lg:px-8 print:p-0 print:bg-white print:text-black">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Page Header (hidden during print) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6 print:hidden">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Ticket className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight">
                My Bookings &amp; Tickets
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              View your confirmed reservations, ticket references, and QR admission codes.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchBookings}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <Link
              to="/movies"
              className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-lg shadow-amber-500/10 transition-all cursor-pointer"
            >
              <Film className="w-3.5 h-3.5" />
              <span>Book Movies</span>
            </Link>
          </div>
        </div>

        {/* Cancellation Success Banner */}
        {cancelSuccessMsg && (
          <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 flex items-center justify-between gap-3 text-xs shadow-lg animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{cancelSuccessMsg}</span>
            </div>
            <button
              onClick={() => setCancelSuccessMsg(null)}
              className="p-1 rounded hover:bg-emerald-900/50 text-emerald-400 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Filter Tabs (hidden during print) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin print:hidden">
          {[
            { id: 'all', label: 'All Bookings' },
            { id: 'upcoming', label: 'Upcoming Shows' },
            { id: 'past', label: 'Past Shows' },
            { id: 'pending', label: 'Pending Payment' },
            { id: 'cancelled', label: 'Cancelled & Refunded' },
            { id: 'failed', label: 'Failed / Expired' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800/80 hover:bg-slate-800/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="grid gap-4 print:hidden">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 animate-pulse flex flex-col md:flex-row gap-6"
              >
                <div className="w-20 h-28 bg-slate-800 rounded-2xl shrink-0" />
                <div className="flex-1 space-y-3">
                  <div className="h-5 bg-slate-800 rounded w-1/3" />
                  <div className="h-4 bg-slate-800 rounded w-1/4" />
                  <div className="h-4 bg-slate-800 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-8 rounded-3xl bg-red-950/30 border border-red-800/60 text-center space-y-4 max-w-lg mx-auto print:hidden">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
            <div>
              <h3 className="text-base font-bold text-white">Could not load bookings</h3>
              <p className="text-xs text-red-300 mt-1">{error}</p>
            </div>
            <button
              onClick={fetchBookings}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
            >
              Try Again
            </button>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="p-12 rounded-3xl bg-slate-900/50 border border-slate-800/80 text-center space-y-4 max-w-md mx-auto my-8 print:hidden">
            <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-500 mx-auto">
              <Ticket className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">No bookings found</h3>
              <p className="text-xs text-slate-400 mt-1">
                {activeTab === 'all'
                  ? 'You haven’t made any cinema reservations yet.'
                  : `No bookings matching the "${activeTab}" category.`}
              </p>
            </div>
            <Link
              to="/movies"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-amber-500/10 cursor-pointer"
            >
              <span>Explore Movies &amp; Showtimes</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredBookings.map((b) => (
              <div
                key={b.id}
                className="p-5 sm:p-6 rounded-3xl bg-slate-900/80 border border-slate-800/90 hover:border-slate-700 transition-all shadow-xl space-y-5 print:border-black print:shadow-none"
              >
                {/* Top Row: Reference, Status Badge & Timestamp */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/70 pb-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">
                      Booking Ref:
                    </span>
                    <button
                      onClick={() => handleCopyRef(b.bookingReference)}
                      title="Click to copy booking reference"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono font-bold text-amber-400 hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <span>{b.bookingReference}</span>
                      {copiedRef === b.bookingReference ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3 text-slate-500" />
                      )}
                    </button>
                    {getStatusBadge(b.status)}
                  </div>

                  <div className="text-[11px] text-slate-400">
                    Booked on {formatDate(b.createdAt)} at {formatTime(b.createdAt)}
                  </div>
                </div>

                {/* Middle Row: Movie, Theatre, Seats & Price Details */}
                <div className="flex flex-col md:flex-row gap-5 items-start">
                  {/* Poster Thumbnail */}
                  <img
                    src={b.movie?.posterUrl || FALLBACK_POSTER}
                    alt={b.movie?.title || 'Movie Poster'}
                    className="w-20 h-28 object-cover rounded-2xl border border-slate-800 bg-slate-950 shrink-0 shadow-md"
                  />

                  {/* Movie and Show Details */}
                  <div className="flex-1 space-y-2.5 min-w-0">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base sm:text-lg font-bold text-white truncate">
                          {b.movie?.title}
                        </h3>
                        {b.show?.format && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-extrabold text-[10px] border border-amber-500/30">
                            {b.show.format}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {b.movie?.duration ? formatDuration(b.movie.duration) : ''} •{' '}
                        {b.movie?.language} • {b.movie?.rating}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-300">
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-amber-500" />
                        <strong>{b.theatre?.name}</strong> ({b.theatre?.city})
                      </span>
                      <span>•</span>
                      <span className="text-slate-400">{b.screen?.name}</span>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        {formatDate(b.show?.startTime)} at {formatTime(b.show?.startTime)}
                      </span>
                    </div>

                    {/* Seats & Individual Digital Tickets List */}
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                        <span>Admission Tickets ({b.tickets?.length || b.seats?.length}):</span>
                      </div>

                      {b.tickets && b.tickets.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {b.tickets.map((t) => (
                            <div
                              key={t.id}
                              className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
                            >
                              <div>
                                <span className="font-mono text-amber-400 font-bold block text-[11px]">
                                  {t.ticketNumber}
                                </span>
                                <span className="text-slate-300 text-[11px]">
                                  Seat <strong>{t.seatRow}{t.seatNumber}</strong> ({t.seatCategory || 'REGULAR'})
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                    t.status === 'VALID'
                                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                      : 'bg-zinc-800 text-zinc-400'
                                  }`}
                                >
                                  {t.status}
                                </span>

                                <button
                                  onClick={() => handleViewTicket(t.id)}
                                  className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <QrCode className="w-3 h-3" />
                                  <span>View QR</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {b.seats?.map((seat) => (
                            <span
                              key={seat.bookingSeatId}
                              className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-[11px] font-semibold text-slate-200"
                            >
                              {seat.row}
                              {seat.seatNumber} ({seat.category}) • ₹{seat.price}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Pricing & Action */}
                  <div className="w-full md:w-56 shrink-0 flex flex-col justify-between items-start md:items-end border-t md:border-t-0 md:border-l border-slate-800 pt-4 md:pt-0 md:pl-5 space-y-3">
                    <div className="text-left md:text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                        Total Amount
                      </span>
                      <span className="text-xl sm:text-2xl font-black text-amber-400">
                        ₹{b.totalAmount.toFixed(2)}
                      </span>
                    </div>

                    {/* Latest Payment Status */}
                    {b.latestPayment && (
                      <div className="text-left md:text-right text-[11px] text-slate-400 space-y-0.5">
                        <div className="flex items-center md:justify-end gap-1 font-medium">
                          <CreditCard className="w-3 h-3 text-slate-500" />
                          <span>Method: {b.latestPayment.paymentMethod}</span>
                        </div>
                        {b.latestPayment.status === 'SUCCESS' ? (
                          <span className="text-emerald-400 font-semibold block">
                            ✓ Payment Complete
                          </span>
                        ) : b.latestPayment.status === 'FAILED' ? (
                          <span className="text-red-400 font-semibold block">
                            ✕ Payment Declined
                          </span>
                        ) : (
                          <span className="text-amber-400 font-semibold block">
                            Payment Pending
                          </span>
                        )}
                      </div>
                    )}

                    {/* Refund Status if Cancelled */}
                    {b.status === 'CANCELLED' && b.latestRefund && (
                      <div className="text-left md:text-right text-[11px] space-y-0.5 bg-rose-950/20 border border-rose-900/30 rounded-xl p-2 w-full">
                        <div className="flex items-center md:justify-end gap-1 text-rose-400 font-bold">
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Simulated Refund</span>
                        </div>
                        <span className="text-white font-mono font-bold block">
                          ₹{b.latestRefund.amount?.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono block truncate">
                          Ref: {b.latestRefund.refundReference}
                        </span>
                      </div>
                    )}

                    {/* Actions */}
                    {b.status === 'PENDING_PAYMENT' ? (
                      <button
                        onClick={() => navigate(`/shows/${b.show?.id}/seats`)}
                        className="w-full px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-amber-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>Complete Payment</span>
                      </button>
                    ) : (
                      b.status === 'CONFIRMED' && (
                        <div className="w-full space-y-2">
                          {b.tickets && b.tickets.length > 0 && (
                            <button
                              onClick={() => handleViewTicket(b.tickets[0].id)}
                              className="w-full px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                              <span>View Digital Ticket</span>
                            </button>
                          )}

                          {(() => {
                            const showStart = b.show?.startTime ? new Date(b.show.startTime) : null;
                            const isShowPast = showStart && showStart <= now;
                            const cutoffMs = 2 * 60 * 60 * 1000;
                            const isWithinCutoff =
                              showStart && showStart.getTime() - now.getTime() < cutoffMs;
                            const hasUsedTicket = (b.tickets || []).some((t) => t.status === 'USED');
                            const canCancel = !isShowPast && !isWithinCutoff && !hasUsedTicket;

                            if (canCancel) {
                              return (
                                <button
                                  onClick={() => {
                                    setCancellingBooking(b);
                                    setCancelError(null);
                                  }}
                                  className="w-full px-3 py-1.5 rounded-xl bg-red-950/30 hover:bg-red-950/60 text-red-300 border border-red-800/50 hover:border-red-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                  <Ban className="w-3 h-3 text-red-400" />
                                  <span>Cancel Booking</span>
                                </button>
                              );
                            }

                            if (isWithinCutoff && !isShowPast) {
                              return (
                                <span className="text-[10px] text-amber-500/80 font-medium text-center md:text-right block w-full">
                                  Cancellation closed (&lt; 2h to show)
                                </span>
                              );
                            }

                            return null;
                          })()}
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Digital Ticket Presentation Modal (Perforated Cinema Stub) */}
        {(selectedTicket || ticketLoading) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 sm:p-7 space-y-6 shadow-2xl relative my-8 print:m-0 print:border-none print:shadow-none print:p-0">
              {ticketLoading ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
                  <p className="text-xs text-slate-400">Loading digital admission pass...</p>
                </div>
              ) : selectedTicket ? (
                <>
                  {/* Modal Header */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 print:hidden">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                        Official Admission Ticket
                      </span>
                    </div>
                    <button
                      onClick={() => setSelectedTicket(null)}
                      className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Cinema Ticket Card (Stylized Admission Stub) */}
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative">
                    {/* Top Perforated Notch Left/Right */}
                    <div className="relative p-5 border-b border-dashed border-slate-800">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] uppercase font-black text-amber-400 tracking-widest block">
                            Algions Cineplex
                          </span>
                          <h3 className="text-base font-black text-white mt-0.5">
                            {selectedTicket.movie?.title}
                          </h3>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {selectedTicket.theatre?.name} • {selectedTicket.screen?.name} ({selectedTicket.show?.format})
                          </p>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-extrabold text-amber-300">
                          {selectedTicket.status}
                        </span>
                      </div>
                    </div>

                    {/* Middle Section: QR Code & Verification Token */}
                    <div className="p-6 flex flex-col items-center justify-center space-y-3 bg-white text-slate-950">
                      <div className="w-52 h-52 bg-white p-2 rounded-xl border border-slate-200 flex items-center justify-center shadow-inner">
                        {selectedTicket.qrCode ? (
                          <img
                            src={selectedTicket.qrCode}
                            alt="Ticket QR Code"
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <QrCode className="w-24 h-24 text-slate-400" />
                        )}
                      </div>

                      <div className="text-center space-y-1">
                        <span className="text-[10px] font-mono uppercase font-bold text-slate-500 tracking-wider block">
                          Ticket No: {selectedTicket.ticketNumber}
                        </span>
                        <p className="text-[10px] text-slate-600 max-w-[220px]">
                          Present this digital QR pass to the theatre gate staff upon entry.
                        </p>
                      </div>
                    </div>

                    {/* Bottom Perforated Stub: Seat and Showtime Breakdown */}
                    <div className="p-5 bg-slate-950 border-t border-dashed border-slate-800 space-y-3 text-xs">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">
                            Showtime
                          </span>
                          <span className="font-bold text-white text-[11px]">
                            {formatDate(selectedTicket.show?.startTime)}
                          </span>
                          <span className="block text-[11px] text-amber-400 font-semibold">
                            {formatTime(selectedTicket.show?.startTime)}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">
                            Seat Allocation
                          </span>
                          <span className="font-black text-amber-400 text-sm">
                            Row {selectedTicket.seat?.row}, Seat {selectedTicket.seat?.seatNumber}
                          </span>
                          <span className="block text-[10px] text-slate-400">
                            {selectedTicket.seat?.category} • ₹{selectedTicket.seat?.price}
                          </span>
                        </div>
                      </div>

                      {/* Token Copy Action for Manual Entry Testing */}
                      <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-[11px] text-slate-400">
                        <span className="truncate max-w-[180px] font-mono text-[10px] text-slate-500">
                          Token: {selectedTicket.qrToken ? `${selectedTicket.qrToken.slice(0, 16)}...` : 'N/A'}
                        </span>
                        {selectedTicket.qrToken && (
                          <button
                            onClick={() => handleCopyToken(selectedTicket.qrToken)}
                            className="flex items-center gap-1 text-[10px] font-bold text-amber-400 hover:text-amber-300 cursor-pointer"
                          >
                            {copiedToken ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedToken ? 'Copied Token' : 'Copy Token'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Modal Action Controls (Print & Close) */}
                  <div className="flex gap-3 pt-2 print:hidden">
                    <button
                      onClick={() => window.print()}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Print Ticket</span>
                    </button>
                    <button
                      onClick={() => setSelectedTicket(null)}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-amber-500/20 cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}

        {/* Cancellation Confirmation Dialog Modal */}
        {cancellingBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-red-900/60 rounded-3xl w-full max-w-lg p-6 sm:p-7 space-y-5 shadow-2xl relative my-8 animate-fadeIn">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                  <ShieldAlert className="w-5 h-5 text-red-400" />
                  <span>Confirm Booking Cancellation</span>
                </div>
                <button
                  onClick={() => setCancellingBooking(null)}
                  disabled={cancelLoading}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Booking Details Snapshot */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between font-mono">
                  <span className="text-slate-400">Booking Reference:</span>
                  <span className="text-amber-400 font-bold">{cancellingBooking.bookingReference}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Movie:</span>
                  <span className="text-white font-semibold">{cancellingBooking.movie?.title}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Showtime:</span>
                  <span className="text-slate-300">
                    {formatDate(cancellingBooking.show?.startTime)} at {formatTime(cancellingBooking.show?.startTime)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Seats Reserved:</span>
                  <span className="text-amber-400 font-bold">{cancellingBooking.seatSummary}</span>
                </div>
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between font-bold">
                  <span className="text-slate-300">Refund Amount (100%):</span>
                  <span className="text-emerald-400 text-sm">₹{cancellingBooking.totalAmount?.toFixed(2)}</span>
                </div>
              </div>

              {/* Policy Explanation */}
              <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-800/40 text-amber-200/90 text-xs space-y-1.5">
                <p className="font-semibold text-amber-400">
                  Cancellation Policy & Rules:
                </p>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-200/80">
                  <li>Full simulated refund of ₹{cancellingBooking.totalAmount?.toFixed(2)} will be issued immediately.</li>
                  <li>Reserved seats will be released and returned to available inventory.</li>
                  <li>All digital QR entry tickets will be marked CANCELLED and rejected at the gate.</li>
                  <li>This cancellation is permanent and cannot be reversed.</li>
                </ul>
              </div>

              {/* Cancellation Reason Selection */}
              <div className="space-y-1.5 text-xs">
                <label className="text-slate-300 font-semibold block">Reason for Cancellation (optional):</label>
                <select
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  disabled={cancelLoading}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-amber-500"
                >
                  <option value="Change of schedule / plans">Change of schedule / plans</option>
                  <option value="Booked wrong movie or showtime">Booked wrong movie or showtime</option>
                  <option value="Selected incorrect seats">Selected incorrect seats</option>
                  <option value="Unable to attend">Unable to attend</option>
                  <option value="Personal emergency">Personal emergency</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Error Alert */}
              {cancelError && (
                <div className="p-3 rounded-xl bg-red-950/50 border border-red-800 text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{cancelError}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCancellingBooking(null)}
                  disabled={cancelLoading}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
                >
                  Keep Booking
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCancel}
                  disabled={cancelLoading}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-md shadow-red-900/30 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {cancelLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Cancelling...</span>
                    </>
                  ) : (
                    <>
                      <Ban className="w-3.5 h-3.5" />
                      <span>Yes, Cancel Booking</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
