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
} from 'lucide-react';

export const MyBookingsPage = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [copiedRef, setCopiedRef] = useState(null);

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

  // Copy booking reference
  const handleCopyRef = (ref) => {
    navigator.clipboard?.writeText(ref);
    setCopiedRef(ref);
    setTimeout(() => setCopiedRef(null), 2000);
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

    if (activeTab === 'failed') {
      return (
        b.status === 'EXPIRED' ||
        b.status === 'CANCELLED' ||
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
    <div className="min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
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
              View your confirmed reservations, ticket references, and transaction histories.
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

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {[
            { id: 'all', label: 'All Bookings' },
            { id: 'upcoming', label: 'Upcoming Shows' },
            { id: 'past', label: 'Past Shows' },
            { id: 'pending', label: 'Pending Payment' },
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
          <div className="grid gap-4">
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
          <div className="p-8 rounded-3xl bg-red-950/30 border border-red-800/60 text-center space-y-4 max-w-lg mx-auto">
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
          <div className="p-12 rounded-3xl bg-slate-900/50 border border-slate-800/80 text-center space-y-4 max-w-md mx-auto my-8">
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
                className="p-5 sm:p-6 rounded-3xl bg-slate-900/80 border border-slate-800/90 hover:border-slate-700 transition-all shadow-xl space-y-5"
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

                    {/* Seats Pill List */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-xs text-slate-400 mr-1 font-medium">Seats:</span>
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

                    {/* If pending payment and hold is active, allow completing checkout */}
                    {b.status === 'PENDING_PAYMENT' && (
                      <button
                        onClick={() => navigate(`/shows/${b.show?.id}/seats`)}
                        className="w-full px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-amber-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>Complete Payment</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
