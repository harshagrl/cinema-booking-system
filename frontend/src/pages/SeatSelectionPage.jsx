import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import api from '../services/api';
import {
  formatDate,
  formatDuration,
  formatTime,
  formatDateTime,
  FALLBACK_POSTER,
} from '../utils/formatters';
import {
  ArrowLeft,
  Armchair,
  Clock,
  AlertCircle,
  CheckCircle2,
  Lock,
  RefreshCw,
  Sparkles,
  MapPin,
  Film,
  X,
  LogIn,
} from 'lucide-react';

const CATEGORY_COLORS = {
  REGULAR: {
    base: 'bg-slate-800 border-slate-600 text-slate-200 hover:bg-slate-700',
    selected: 'bg-amber-500 border-amber-400 text-slate-950 ring-2 ring-amber-400 shadow-lg shadow-amber-500/30',
    legend: 'bg-slate-800 border-slate-600',
  },
  SILVER: {
    base: 'bg-zinc-700 border-zinc-500 text-zinc-100 hover:bg-zinc-600',
    selected: 'bg-amber-500 border-amber-400 text-slate-950 ring-2 ring-amber-400 shadow-lg shadow-amber-500/30',
    legend: 'bg-zinc-700 border-zinc-500',
  },
  GOLD: {
    base: 'bg-amber-600/30 border-amber-500/60 text-amber-200 hover:bg-amber-600/50',
    selected: 'bg-amber-500 border-amber-400 text-slate-950 ring-2 ring-amber-400 shadow-lg shadow-amber-500/30',
    legend: 'bg-amber-600/40 border-amber-500',
  },
  PREMIUM: {
    base: 'bg-purple-600/30 border-purple-500/60 text-purple-200 hover:bg-purple-600/50',
    selected: 'bg-amber-500 border-amber-400 text-slate-950 ring-2 ring-amber-400 shadow-lg shadow-amber-500/30',
    legend: 'bg-purple-600/40 border-purple-500',
  },
  RECLINER: {
    base: 'bg-emerald-600/30 border-emerald-500/60 text-emerald-200 hover:bg-emerald-600/50',
    selected: 'bg-amber-500 border-amber-400 text-slate-950 ring-2 ring-amber-400 shadow-lg shadow-amber-500/30',
    legend: 'bg-emerald-600/40 border-emerald-500',
  },
};

const MAX_SELECTION = 10;

export const SeatSelectionPage = () => {
  const { showId } = useParams();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Layout & Show data
  const [layoutData, setLayoutData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Selected seats state: array of ShowSeat objects
  const [selectedSeats, setSelectedSeats] = useState([]);

  // Active hold state (if hold successfully established)
  const [activeHold, setActiveHold] = useState(null);
  const [holdSubmitting, setHoldSubmitting] = useState(false);
  const [holdReleasing, setHoldReleasing] = useState(false);
  const [holdError, setHoldError] = useState('');
  const [feedback, setFeedback] = useState(null);

  // Countdown timer in seconds
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  // Load seat layout function
  const reloadSeatLayout = useCallback(() => {
    api.get(`/shows/${showId}/seats`)
      .then((res) => {
        if (res.success && res.data) {
          setLayoutData(res.data);
        }
      })
      .catch((err) => {
        setError(err.message || 'Failed to load seat layout.');
      });
  }, [showId]);

  // Initial load
  useEffect(() => {
    let isMounted = true;

    api.get(`/shows/${showId}/seats`)
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.data) {
          setLayoutData(res.data);
        }
      })
      .catch((err) => {
        if (!isMounted) setError(err.message || 'Failed to load seat layout.');
      })
      .finally(() => {
        if (!isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [showId]);

  // Check if current authenticated user already has an active hold for this show
  useEffect(() => {
    if (!isAuthenticated) return;
    let isMounted = true;

    api.get('/holds/current')
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.data?.hold) {
          const hold = res.data.hold;
          if (hold.showId === showId) {
            setActiveHold(hold);
            setRemainingSeconds(hold.expiresInSeconds);
          }
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, showId]);

  // Countdown clock effect
  useEffect(() => {
    if (!activeHold || remainingSeconds <= 0) return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Hold expired
          setActiveHold(null);
          setFeedback({
            type: 'error',
            message: 'Your 5-minute seat hold has expired. The seats have been released.',
          });
          reloadSeatLayout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeHold, remainingSeconds, reloadSeatLayout]);

  // Auto-dismiss general feedback
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Toggle seat selection
  const handleSeatClick = (seat) => {
    if (activeHold) return; // Cannot modify selection while an active hold is in place

    if (seat.status !== 'AVAILABLE') return;

    const isAlreadySelected = selectedSeats.some((s) => s.id === seat.id);

    if (isAlreadySelected) {
      setSelectedSeats(selectedSeats.filter((s) => s.id !== seat.id));
    } else {
      if (selectedSeats.length >= MAX_SELECTION) {
        setFeedback({
          type: 'error',
          message: `You can select up to ${MAX_SELECTION} seats per booking.`,
        });
        return;
      }
      setSelectedSeats([...selectedSeats, seat]);
    }
  };

  // Submit temporary hold
  const handleCreateHold = async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/shows/${showId}/seats` } });
      return;
    }

    if (selectedSeats.length === 0) {
      setHoldError('Please select at least one seat to hold.');
      return;
    }

    setHoldError('');
    setHoldSubmitting(true);

    try {
      const showSeatIds = selectedSeats.map((s) => s.id);
      const res = await api.post(`/shows/${showId}/holds`, { showSeatIds });

      if (res.success && res.data) {
        setActiveHold(res.data);
        setRemainingSeconds(res.data.expiresInSeconds || 300);
        setFeedback({
          type: 'success',
          message: `Seats held successfully! You have 5 minutes to complete your reservation.`,
        });
        // Clear local selection (the hold state takes over)
        setSelectedSeats([]);
        reloadSeatLayout();
      }
    } catch (err) {
      if (err.code === 'SEAT_ALREADY_HELD') {
        setHoldError('One or more of your selected seats was just held by another customer. Please choose different seats.');
      } else if (err.code === 'SEAT_ALREADY_BOOKED') {
        setHoldError('One or more seats have already been booked. Please refresh the layout.');
      } else {
        setHoldError(err.message || 'Failed to hold seats.');
      }
      reloadSeatLayout();
    } finally {
      setHoldSubmitting(false);
    }
  };

  // Release hold
  const handleReleaseHold = async () => {
    if (!activeHold) return;
    setHoldReleasing(true);

    try {
      await api.delete(`/holds/${activeHold.holdId}`);
      setActiveHold(null);
      setRemainingSeconds(0);
      setFeedback({
        type: 'success',
        message: 'Your seat hold was released successfully.',
      });
      reloadSeatLayout();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to release seat hold.',
      });
    } finally {
      setHoldReleasing(false);
    }
  };

  // Format countdown mm:ss
  const formatCountdown = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Total calculation for current selection
  const selectionTotal = selectedSeats.reduce((sum, s) => sum + s.price, 0);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-slate-950 flex flex-col items-center justify-center space-y-4 text-slate-100">
        <Film className="w-12 h-12 text-amber-500 animate-spin" />
        <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">
          Loading auditorium seat layout...
        </p>
      </div>
    );
  }

  if (error || !layoutData) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-5 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-red-950/60 border border-red-800 flex items-center justify-center text-red-400 mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100">Show Unavailable</h2>
            <p className="text-xs text-slate-400 mt-1">{error || 'This screening is not accessible.'}</p>
          </div>
          <Link
            to="/movies"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-xl border border-slate-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Movies</span>
          </Link>
        </div>
      </div>
    );
  }

  const { show, rows, categoryPricing } = layoutData;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="flex items-center gap-4">
            <Link
              to={`/movies/${show.movie.id}`}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
              title="Back to Movie Details"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>

            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-extrabold text-white">
                  {show.movie.title}
                </h1>
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-extrabold text-xs border border-amber-500/40">
                  {show.format}
                </span>
                <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 text-[11px] font-semibold border border-slate-700">
                  {show.movie.rating || 'UA'}
                </span>
              </div>

              <p className="text-xs text-slate-400 flex flex-wrap items-center gap-2 mt-1">
                <span className="flex items-center gap-1 font-medium text-slate-300">
                  <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  {show.theatre.name} ({show.theatre.city})
                </span>
                <span>•</span>
                <span>{show.screen.name}</span>
                <span>•</span>
                <span className="flex items-center gap-1 font-semibold text-amber-400">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  {formatDateTime(show.startTime)}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={reloadSeatLayout}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all cursor-pointer"
              title="Refresh Availability"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Layout</span>
            </button>
          </div>
        </div>

        {/* Global Feedback Banner */}
        {feedback && (
          <div
            className={`p-3.5 rounded-2xl border flex items-center gap-2.5 text-xs font-semibold ${
              feedback.type === 'success'
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60'
                : 'bg-red-950/40 text-red-300 border-red-800/60'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Active Hold Countdown Banner (Section 7) */}
        {activeHold && (
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-950/40 border border-amber-600/60 shadow-xl shadow-amber-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                <Clock className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase font-extrabold tracking-wider text-amber-400">
                    Seats Temporarily Held
                  </span>
                  <span className="text-xs font-mono font-black px-2 py-0.5 rounded-lg bg-amber-500 text-slate-950 shadow-sm">
                    {formatCountdown(remainingSeconds)}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Held <strong>{activeHold.seats.length} seat(s)</strong>: {activeHold.seats.map((s) => `${s.row}${s.seatNumber}`).join(', ')} • Total: <strong className="text-amber-300">₹{activeHold.totalAmount}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleReleaseHold}
                disabled={holdReleasing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 border border-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {holdReleasing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                <span>Release Seats</span>
              </button>
            </div>
          </div>
        )}

        {/* Hold Error Banner */}
        {holdError && (
          <div className="p-3.5 rounded-2xl bg-red-950/50 border border-red-800 text-red-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
            <span>{holdError}</span>
          </div>
        )}

        {/* Main Grid & Summary Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left/Center: Visual Cinema Screen & Seat Grid */}
          <div className="lg:col-span-3 bg-slate-900/60 border border-slate-800/90 rounded-3xl p-6 sm:p-10 space-y-8 flex flex-col items-center overflow-x-auto shadow-2xl backdrop-blur-sm">
            {/* Curved Cinema Screen Banner */}
            <div className="w-full max-w-2xl flex flex-col items-center">
              <div className="w-full h-3 bg-gradient-to-r from-transparent via-amber-500/80 to-transparent rounded-full blur-[1px] shadow-lg shadow-amber-500/30"></div>
              <div className="w-3/4 h-2 bg-gradient-to-r from-transparent via-slate-400/60 to-transparent rounded-full mt-1"></div>
              <span className="text-[10px] tracking-[0.35em] font-extrabold uppercase text-slate-500 mt-2">
                All Eyes This Way • Cinema Display
              </span>
            </div>

            {/* Seat Layout Grid */}
            <div className="space-y-3 py-4 min-w-max">
              {rows.map((rowGroup) => (
                <div key={rowGroup.row} className="flex items-center gap-3">
                  <span className="w-6 text-center text-xs font-bold text-slate-400 select-none">
                    {rowGroup.row}
                  </span>

                  <div className="flex items-center gap-2">
                    {rowGroup.seats.map((seat) => {
                      const isSelected = selectedSeats.some((s) => s.id === seat.id);
                      const isHeldByMe = activeHold && activeHold.seats?.some((s) => s.showSeatId === seat.id);
                      const colorScheme = CATEGORY_COLORS[seat.category] || CATEGORY_COLORS.REGULAR;

                      let seatClasses;
                      let seatIcon = null;
                      let isClickable = false;

                      if (isHeldByMe) {
                        seatClasses = 'bg-amber-500 border-amber-400 text-slate-950 font-black ring-2 ring-amber-400 shadow-md shadow-amber-500/30';
                        isClickable = false;
                      } else if (isSelected) {
                        seatClasses = colorScheme.selected;
                        isClickable = true;
                      } else if (seat.status === 'BOOKED') {
                        seatClasses = 'bg-slate-950 border-slate-800 text-slate-700 cursor-not-allowed';
                        isClickable = false;
                      } else if (seat.status === 'HELD') {
                        seatClasses = 'bg-slate-950/90 border-slate-800 text-slate-500 cursor-not-allowed opacity-60';
                        seatIcon = <Lock className="w-2.5 h-2.5 mx-auto" />;
                        isClickable = false;
                      } else if (seat.status === 'UNAVAILABLE') {
                        seatClasses = 'bg-slate-950/60 border-slate-900 text-slate-700 line-through cursor-not-allowed';
                        isClickable = false;
                      } else {
                        // AVAILABLE
                        seatClasses = `${colorScheme.base} cursor-pointer`;
                        isClickable = true;
                      }

                      return (
                        <button
                          key={seat.id}
                          onClick={() => isClickable && handleSeatClick(seat)}
                          disabled={!isClickable}
                          title={`Row ${seat.row}, Seat ${seat.seatNumber} (${seat.category}) • ₹${seat.price} • ${seat.status}`}
                          className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl text-xs font-semibold flex flex-col items-center justify-center border transition-all ${seatClasses}`}
                        >
                          {seatIcon || seat.seatNumber}
                        </button>
                      );
                    })}
                  </div>

                  <span className="w-6 text-center text-xs font-bold text-slate-400 select-none">
                    {rowGroup.row}
                  </span>
                </div>
              ))}
            </div>

            {/* Availability & Category Legend */}
            <div className="w-full pt-6 border-t border-slate-800/80 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-md bg-slate-800 border border-slate-600"></div>
                <span>Available</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-md bg-amber-500 border border-amber-400 text-slate-950 flex items-center justify-center text-[10px] font-bold">
                  ✓
                </div>
                <span>Selected</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-md bg-slate-950 border border-slate-800 text-slate-500 flex items-center justify-center text-[9px]">
                  <Lock className="w-2.5 h-2.5" />
                </div>
                <span>Held by Other</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-md bg-slate-950 border border-slate-800 text-slate-700"></div>
                <span>Sold / Booked</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-md bg-slate-950/60 border border-slate-900 text-slate-700 text-[10px] flex items-center justify-center">
                  ✕
                </div>
                <span>Unavailable</span>
              </div>
            </div>

            {/* Category Pricing Legend */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-xs">
              {Object.entries(categoryPricing).map(([cat, pr]) => (
                <span
                  key={cat}
                  className="px-2.5 py-1 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-300 text-[11px]"
                >
                  {cat}: <strong className="text-amber-400">₹{pr}</strong>
                </span>
              ))}
            </div>
          </div>

          {/* Right: Booking Summary & Action Card */}
          <div className="space-y-5">
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-2xl backdrop-blur-md">
              <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                <img
                  src={show.movie.posterUrl || FALLBACK_POSTER}
                  alt={show.movie.title}
                  className="w-12 h-16 object-cover rounded-xl border border-slate-800 bg-slate-950 shrink-0"
                />
                <div>
                  <h3 className="text-sm font-bold text-white line-clamp-1">
                    {show.movie.title}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {formatDuration(show.movie.duration)} • {show.format}
                  </p>
                  <p className="text-[10px] text-amber-400 font-semibold mt-0.5">
                    {formatTime(show.startTime)} • {formatDate(show.startTime)}
                  </p>
                </div>
              </div>

              {/* Selection Details */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                  <span>Selected Seats ({selectedSeats.length})</span>
                  <span className="text-slate-400 text-[11px]">Max {MAX_SELECTION}</span>
                </div>

                {selectedSeats.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-500 space-y-1">
                    <Armchair className="w-5 h-5 mx-auto text-slate-600" />
                    <p>Click on available seats on the layout to select them.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {selectedSeats.map((s) => (
                        <span
                          key={s.id}
                          className="px-2 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center gap-1"
                        >
                          <span>{s.row}{s.seatNumber}</span>
                          <span className="text-[9px] text-amber-400/80">({s.category})</span>
                        </span>
                      ))}
                    </div>

                    <div className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-xl space-y-1 text-xs">
                      {selectedSeats.map((s) => (
                        <div key={s.id} className="flex justify-between text-slate-400 text-[11px]">
                          <span>Seat {s.row}{s.seatNumber} ({s.category})</span>
                          <span className="text-slate-200">₹{s.price}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Total Calculation */}
              <div className="pt-4 border-t border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-slate-400">Total Amount:</span>
                  <span className="text-xl font-black text-amber-400">
                    ₹{activeHold ? activeHold.totalAmount : selectionTotal}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500">
                  Authoritative ticket price verified and locked by PostgreSQL database engine.
                </p>
              </div>

              {/* Primary Action Button */}
              {activeHold ? (
                <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-800/60 text-center space-y-2">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Temporary Seat Hold Active</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Checkout &amp; Payment Gateway integration will be unlocked in <strong>Phase 7 &amp; 8</strong>.
                  </p>
                </div>
              ) : isAuthenticated ? (
                <button
                  onClick={handleCreateHold}
                  disabled={selectedSeats.length === 0 || holdSubmitting}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold uppercase tracking-wider transition-all disabled:opacity-50 shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  {holdSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>{holdSubmitting ? 'Holding Seats...' : 'Hold Selected Seats'}</span>
                </button>
              ) : (
                <button
                  onClick={handleCreateHold}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Log In to Hold Seats</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
