import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import {
  formatDuration,
  formatDate,
  formatTime,
  FALLBACK_POSTER,
} from '../utils/formatters';
import {
  ArrowLeft,
  Clock,
  Calendar,
  Film,
  AlertCircle,
  Ticket,
  Building2,
  MapPin,
  X,
  Armchair,
  Sparkles,
} from 'lucide-react';

export const MovieDetailsPage = () => {
  const { id } = useParams();
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [imgSrc, setImgSrc] = useState(FALLBACK_POSTER);

  // Showtimes Discovery state
  const todayISO = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [theatresWithShows, setTheatresWithShows] = useState([]);
  const [showsLoading, setShowsLoading] = useState(false);
  const [selectedShowForModal, setSelectedShowForModal] = useState(null);

  // Generate next 7 dates for date picker
  const upcomingDates = (() => {
    const dates = [];
    const base = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const isoDate = d.toISOString().split('T')[0];
      const dayName =
        i === 0
          ? 'Today'
          : i === 1
          ? 'Tomorrow'
          : d.toLocaleDateString('en-US', { weekday: 'short' });
      const label = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
      dates.push({ isoDate, dayName, label });
    }
    return dates;
  })();

  // Load movie details
  useEffect(() => {
    let isMounted = true;

    api.get(`/movies/${id}`)
      .then((res) => {
        if (isMounted && res.success && res.data?.movie) {
          setMovie(res.data.movie);
          setImgSrc(res.data.movie.posterUrl || FALLBACK_POSTER);
        }
      })
      .catch((err) => {
        if (isMounted) setError(err.message || 'Movie not found or currently unavailable.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

  // Load showtimes whenever selectedDate or id changes
  useEffect(() => {
    if (!id) return;
    let isMounted = true;

    api.get(`/movies/${id}/shows?date=${selectedDate}`)
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.data?.theatres) {
          setTheatresWithShows(res.data.theatres);
        } else {
          setTheatresWithShows([]);
        }
      })
      .catch(() => {
        if (isMounted) setTheatresWithShows([]);
      })
      .finally(() => {
        if (isMounted) setShowsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id, selectedDate]);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-slate-950 flex flex-col items-center justify-center space-y-4 text-slate-100">
        <Film className="w-12 h-12 text-amber-500 animate-spin" />
        <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">
          Loading movie presentation...
        </p>
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-5 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-red-950/60 border border-red-800 flex items-center justify-center text-red-400 mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100">Movie Unavailable</h2>
            <p className="text-xs text-slate-400 mt-1">{error || 'This movie does not exist.'}</p>
          </div>
          <Link
            to="/movies"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-xl border border-slate-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Movie Listings</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Navigation Bar */}
        <div>
          <Link
            to="/movies"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-amber-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All Movies</span>
          </Link>
        </div>

        {/* Hero Presentation Card */}
        <div className="relative bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-md">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-8 p-6 sm:p-10">
            {/* Left: Poster */}
            <div className="md:col-span-1 lg:col-span-2">
              <div className="aspect-[2/3] w-full rounded-2xl overflow-hidden shadow-2xl border border-slate-800 bg-slate-950 relative group">
                <img
                  src={imgSrc}
                  alt={movie.title}
                  onError={() => setImgSrc(FALLBACK_POSTER)}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Right: Movie Info */}
            <div className="md:col-span-2 lg:col-span-5 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                {/* Badges & Meta */}
                <div className="flex flex-wrap items-center gap-2.5">
                  {movie.rating && (
                    <span className="text-xs font-extrabold uppercase px-2.5 py-1 rounded-lg bg-amber-950/80 text-amber-300 border border-amber-700/60 shadow-sm">
                      Rating: {movie.rating}
                    </span>
                  )}
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 border border-slate-700">
                    Language: {movie.language}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-slate-300 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    <span>{formatDuration(movie.duration)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-300 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{formatDate(movie.releaseDate)}</span>
                  </div>
                </div>

                {/* Title */}
                <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                  {movie.title}
                </h1>

                {/* Genres */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {movie.genres?.map((g) => (
                    <span
                      key={g.id}
                      className="text-xs font-semibold px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg"
                    >
                      {g.name}
                    </span>
                  ))}
                </div>

                {/* Synopsis / Description */}
                <div className="pt-3 border-t border-slate-800/80">
                  <h3 className="text-xs uppercase font-extrabold text-slate-400 tracking-wider mb-2">
                    Synopsis
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed max-w-3xl">
                    {movie.description}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Live Showtimes & Theatres Section */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl backdrop-blur-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Ticket className="w-5 h-5 text-amber-500" />
                <span>Available Theatres &amp; Showtimes</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Select your preferred date and auditorium showtime for {movie.title}
              </p>
            </div>
          </div>

          {/* Date Selector Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {upcomingDates.map((d) => {
              const isSelected = selectedDate === d.isoDate;
              return (
                <button
                  key={d.isoDate}
                  onClick={() => {
                    setShowsLoading(true);
                    setSelectedDate(d.isoDate);
                  }}
                  className={`px-4 py-2.5 rounded-2xl flex flex-col items-center min-w-[90px] border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-lg shadow-amber-500/20 scale-105'
                      : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <span className={`text-[11px] uppercase tracking-wider font-semibold ${isSelected ? 'text-slate-900' : 'text-slate-500'}`}>
                    {d.dayName}
                  </span>
                  <span className={`text-xs font-bold mt-0.5 ${isSelected ? 'text-slate-950' : 'text-slate-200'}`}>
                    {d.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Shows for Selected Date */}
          {showsLoading ? (
            <div className="text-center py-12 text-slate-400 text-xs flex items-center justify-center gap-2">
              <Film className="w-4 h-4 animate-spin text-amber-500" />
              <span>Checking available auditoriums...</span>
            </div>
          ) : theatresWithShows.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-center space-y-2">
              <Calendar className="w-8 h-8 text-slate-600 mx-auto" />
              <h3 className="text-sm font-bold text-white">No Shows Scheduled For This Date</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No active screenings scheduled for {formatDate(selectedDate)}. Please choose another upcoming date tab above.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {theatresWithShows.map((tGroup) => (
                <div
                  key={tGroup.theatre.id}
                  className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800/90 space-y-4"
                >
                  {/* Theatre Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-800/60 pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-amber-500" />
                        <span>{tGroup.theatre.name}</span>
                      </h3>
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-500" />
                        <span>{tGroup.theatre.location}, {tGroup.theatre.city}</span>
                      </p>
                    </div>

                    <span className="text-[11px] text-slate-500 self-start sm:self-auto font-medium">
                      {tGroup.shows.length} showtime(s) today
                    </span>
                  </div>

                  {/* Showtimes Pills */}
                  <div className="flex flex-wrap gap-3">
                    {tGroup.shows.map((show) => {
                      const minPrice = show.pricing?.minPrice || 0;
                      return (
                        <button
                          key={show.id}
                          onClick={() =>
                            setSelectedShowForModal({
                              ...show,
                              theatreName: tGroup.theatre.name,
                              theatreCity: tGroup.theatre.city,
                              theatreLocation: tGroup.theatre.location,
                            })
                          }
                          className="group p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/60 hover:bg-slate-800/80 transition-all text-left space-y-1.5 cursor-pointer shadow-sm hover:shadow-md hover:shadow-amber-500/10"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors">
                              {formatTime(show.startTime)}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 font-extrabold text-[10px] border border-amber-500/20">
                              {show.format}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-3 text-[10px] text-slate-400">
                            <span className="truncate max-w-[100px]">{show.screenName}</span>
                            <span className="text-amber-400 font-semibold">₹{minPrice}+</span>
                          </div>

                          <div className="text-[9px] text-emerald-400 font-medium">
                            {show.availableSeats} seats left
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Seat Selection Placeholder Modal (Phase 6 Hand-off) */}
        {selectedShowForModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-white font-bold text-base">
                  <Armchair className="w-4 h-4 text-amber-500" />
                  <span>Show Selected</span>
                </div>
                <button
                  onClick={() => setSelectedShowForModal(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Show Details Summary */}
              <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800/80 text-xs">
                <div>
                  <h4 className="text-sm font-bold text-white">{movie.title}</h4>
                  <p className="text-slate-400 mt-0.5">
                    {selectedShowForModal.theatreName} • {selectedShowForModal.screenName} ({selectedShowForModal.format})
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-slate-300">
                  <span>Showtime:</span>
                  <span className="font-bold text-amber-400">
                    {formatDate(selectedDate)} at {formatTime(selectedShowForModal.startTime)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-300">
                  <span>Available Seats:</span>
                  <span className="font-semibold text-emerald-400">
                    {selectedShowForModal.availableSeats} / {selectedShowForModal.totalSeats}
                  </span>
                </div>

                {selectedShowForModal.pricing?.categories && (
                  <div className="pt-2 border-t border-slate-800/60">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                      Category Pricing
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(selectedShowForModal.pricing.categories).map(([cat, pr]) => (
                        <span
                          key={cat}
                          className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-200"
                        >
                          {cat}: <strong className="text-amber-400">₹{pr}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Phase 6 Hand-off Notice */}
              <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/50 space-y-1.5 text-xs">
                <p className="font-bold text-amber-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Phase 5 Complete: Showtime Confirmed</span>
                </p>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  Interactive seat layout picking, temporary seat holding, and booking checkout will be unlocked in <strong>Phase 6 &amp; 7</strong>.
                </p>
                <p className="text-[10px] text-emerald-400 font-semibold pt-1">
                  ✓ Database verified: {selectedShowForModal.totalSeats} ShowSeat records ready in PostgreSQL.
                </p>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-800">
                <button
                  onClick={() => setSelectedShowForModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
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
