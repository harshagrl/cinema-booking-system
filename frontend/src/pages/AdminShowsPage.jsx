import { useState, useEffect } from 'react';
import api from '../services/api';
import { formatDuration, formatTime, formatDateTime, FALLBACK_POSTER } from '../utils/formatters';
import {
  Calendar,
  Clock,
  Plus,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  X,
  Search,
  RefreshCw,
  MapPin,
} from 'lucide-react';

const FORMAT_OPTIONS = ['2D', '3D', 'IMAX', '4DX'];

const DEFAULT_PRICING = {
  REGULAR: 200,
  SILVER: 180,
  GOLD: 250,
  PREMIUM: 350,
  RECLINER: 500,
};

export const AdminShowsPage = () => {
  // Shows list state
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);

  // Metadata dropdowns
  const [movies, setMovies] = useState([]);
  const [theatres, setTheatres] = useState([]);

  // Filter states
  const [selectedMovieFilter, setSelectedMovieFilter] = useState('');
  const [selectedTheatreFilter, setSelectedTheatreFilter] = useState('');
  const [selectedScreenFilter, setSelectedScreenFilter] = useState('');
  const [selectedFormatFilter, setSelectedFormatFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [includeInactive, setIncludeInactive] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Alerts
  const [feedback, setFeedback] = useState(null);

  // Create / Edit Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingShow, setEditingShow] = useState(null);
  const [modalScreens, setModalScreens] = useState([]);
  const [modalScreensLoading, setModalScreensLoading] = useState(false);

  const [formData, setFormData] = useState({
    movieId: '',
    theatreId: '',
    screenId: '',
    startTime: '',
    format: '2D',
    bufferMinutes: 15,
    pricing: { ...DEFAULT_PRICING },
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Auto-dismiss feedback alert
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Load Movies and Theatres for selectors on mount
  useEffect(() => {
    let isMounted = true;

    Promise.all([
      api.get('/movies?limit=100'),
      api.get('/theatres'),
    ])
      .then(([moviesRes, theatresRes]) => {
        if (!isMounted) return;
        if (moviesRes.success && moviesRes.data?.movies) {
          setMovies(moviesRes.data.movies);
        }
        if (theatresRes.success && theatresRes.data?.theatres) {
          setTheatres(theatresRes.data.theatres);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setFeedback({ type: 'error', message: err.message || 'Failed to load options.' });
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch shows whenever filters change
  useEffect(() => {
    let isMounted = true;
    const query = new URLSearchParams();
    if (includeInactive) query.set('includeInactive', 'true');
    if (selectedMovieFilter) query.set('movieId', selectedMovieFilter);
    if (selectedTheatreFilter) query.set('theatreId', selectedTheatreFilter);
    if (selectedScreenFilter) query.set('screenId', selectedScreenFilter);
    if (selectedFormatFilter) query.set('format', selectedFormatFilter);
    if (dateFilter) query.set('date', dateFilter);

    api.get(`/shows?${query.toString()}`)
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.data?.shows) {
          setShows(res.data.shows);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setFeedback({ type: 'error', message: err.message || 'Failed to load shows.' });
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [
    selectedMovieFilter,
    selectedTheatreFilter,
    selectedScreenFilter,
    selectedFormatFilter,
    dateFilter,
    includeInactive,
  ]);

  // Helper reload
  const reloadShows = () => {
    const query = new URLSearchParams();
    if (includeInactive) query.set('includeInactive', 'true');
    if (selectedMovieFilter) query.set('movieId', selectedMovieFilter);
    if (selectedTheatreFilter) query.set('theatreId', selectedTheatreFilter);
    if (selectedScreenFilter) query.set('screenId', selectedScreenFilter);
    if (selectedFormatFilter) query.set('format', selectedFormatFilter);
    if (dateFilter) query.set('date', dateFilter);

    api.get(`/shows?${query.toString()}`)
      .then((res) => {
        if (res.success && res.data?.shows) {
          setShows(res.data.shows);
        }
      })
      .catch((err) => {
        setFeedback({ type: 'error', message: err.message || 'Failed to load shows.' });
      });
  };

  // When theatre in Modal changes, load its screens
  const handleModalTheatreChange = (theatreId) => {
    setFormData((prev) => ({
      ...prev,
      theatreId,
      screenId: '',
      format: '2D',
    }));

    if (!theatreId) {
      setModalScreens([]);
      return;
    }

    setModalScreensLoading(true);
    api.get(`/theatres/${theatreId}/screens`)
      .then((res) => {
        if (res.success && res.data?.screens) {
          setModalScreens(res.data.screens);
        }
      })
      .catch((err) => {
        setFormError(err.message || 'Failed to load screens for theatre.');
      })
      .finally(() => {
        setModalScreensLoading(false);
      });
  };

  // Open Schedule Show Modal
  const handleOpenScheduleModal = () => {
    setEditingShow(null);
    setFormError('');
    // Prefill date with upcoming slot (e.g. tomorrow at 11:30)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(11, 30, 0, 0);
    const tzOffset = tomorrow.getTimezoneOffset() * 60000;
    const localISOTime = new Date(tomorrow.getTime() - tzOffset).toISOString().slice(0, 16);

    setFormData({
      movieId: movies[0]?.id || '',
      theatreId: theatres[0]?.id || '',
      screenId: '',
      startTime: localISOTime,
      format: '2D',
      bufferMinutes: 15,
      pricing: { ...DEFAULT_PRICING },
    });

    if (theatres[0]?.id) {
      handleModalTheatreChange(theatres[0].id);
    }
    setModalOpen(true);
  };

  // Open Edit Show Modal
  const handleOpenEditModal = (show) => {
    setEditingShow(show);
    setFormError('');
    const d = new Date(show.startTime);
    const tzOffset = d.getTimezoneOffset() * 60000;
    const localISOTime = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);

    setFormData({
      movieId: show.movie.id,
      theatreId: show.screen.theatre.id,
      screenId: show.screen.id,
      startTime: localISOTime,
      format: show.format,
      bufferMinutes: 15,
      pricing: {
        ...DEFAULT_PRICING,
        ...(show.pricing?.categories || {}),
      },
    });

    // Load screens for theatre
    api.get(`/theatres/${show.screen.theatre.id}/screens`)
      .then((res) => {
        if (res.success && res.data?.screens) {
          setModalScreens(res.data.screens);
        }
      })
      .catch(() => {});

    setModalOpen(true);
  };

  // Calculate live end time based on selected movie duration + buffer
  const selectedMovieObj = movies.find((m) => m.id === formData.movieId);
  const selectedScreenObj = modalScreens.find((s) => s.id === formData.screenId);

  const calculateProjectedEndTime = () => {
    if (!formData.startTime || !selectedMovieObj) return null;
    try {
      const startMs = new Date(formData.startTime).getTime();
      if (isNaN(startMs)) return null;
      const durationMs = (selectedMovieObj.duration || 120) * 60 * 1000;
      const bufferMs = (parseInt(formData.bufferMinutes, 10) || 0) * 60 * 1000;
      const endMs = startMs + durationMs + bufferMs;
      return new Date(endMs);
    } catch {
      return null;
    }
  };

  const projectedEndTime = calculateProjectedEndTime();

  // Submit Create or Edit Show
  const handleSubmitShow = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSubmitting(true);

    try {
      const startISO = new Date(formData.startTime).toISOString();

      if (editingShow) {
        await api.put(`/shows/${editingShow.id}`, {
          startTime: startISO,
          format: formData.format,
          bufferMinutes: parseInt(formData.bufferMinutes, 10) || 15,
          pricing: formData.pricing,
        });
        setFeedback({ type: 'success', message: 'Show updated successfully.' });
      } else {
        await api.post('/shows', {
          movieId: formData.movieId,
          screenId: formData.screenId,
          startTime: startISO,
          format: formData.format,
          bufferMinutes: parseInt(formData.bufferMinutes, 10) || 15,
          pricing: formData.pricing,
        });
        setFeedback({ type: 'success', message: 'Show scheduled successfully with initialized ShowSeats.' });
      }

      setModalOpen(false);
      reloadShows();
    } catch (err) {
      if (err.code === 'SHOWTIME_OVERLAP') {
        setFormError(`Scheduling Conflict: ${err.message}`);
      } else {
        setFormError(err.message || 'Failed to save show.');
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  // Toggle Show Status
  const handleToggleShowStatus = async (show) => {
    const nextStatus = !show.isActive;
    try {
      await api.patch(`/shows/${show.id}/status`, { isActive: nextStatus });
      setFeedback({
        type: 'success',
        message: `Show for "${show.movie.title}" ${nextStatus ? 'activated' : 'deactivated'}.`,
      });
      reloadShows();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to change show status.' });
    }
  };

  // Client-side text search
  const filteredShows = shows.filter((show) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      show.movie.title.toLowerCase().includes(q) ||
      show.screen.theatre.name.toLowerCase().includes(q) ||
      show.screen.name.toLowerCase().includes(q) ||
      show.screen.theatre.city?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/20">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Showtime Scheduling &amp; Management
              </h1>
              <p className="text-xs text-slate-400">
                Plan screenings, prevent concurrent schedule overlaps, and configure category pricing
              </p>
            </div>
          </div>

          <button
            onClick={handleOpenScheduleModal}
            className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 transition-all self-start sm:self-auto cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Schedule Show
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs font-medium ${
              feedback.type === 'success'
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60'
                : 'bg-red-950/40 text-red-300 border-red-800/60'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Filters Bar */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search */}
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">
              <Search className="w-4 h-4 text-slate-500 shrink-0" />
              <input
                type="text"
                placeholder="Search movie, theatre, screen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-white focus:outline-none placeholder:text-slate-600 text-xs"
              />
            </div>

            {/* Movie Filter */}
            <select
              value={selectedMovieFilter}
              onChange={(e) => setSelectedMovieFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none"
            >
              <option value="">All Movies</option>
              {movies.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>

            {/* Theatre Filter */}
            <select
              value={selectedTheatreFilter}
              onChange={(e) => {
                setSelectedTheatreFilter(e.target.value);
                setSelectedScreenFilter('');
              }}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none"
            >
              <option value="">All Theatres</option>
              {theatres.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.city})
                </option>
              ))}
            </select>

            {/* Date Filter */}
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none"
            />

            {/* Format Filter */}
            <select
              value={selectedFormatFilter}
              onChange={(e) => setSelectedFormatFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none"
            >
              <option value="">All Formats</option>
              {FORMAT_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-slate-400">
            <span className="text-[11px]">
              Found <strong className="text-white">{filteredShows.length}</strong> scheduled show(s)
            </span>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
                className="rounded border-slate-700 text-amber-500 focus:ring-0"
              />
              <span className="text-xs">Include Inactive Shows</span>
            </label>
          </div>
        </div>

        {/* Shows Listing */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-xs gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
            Loading scheduled showtimes...
          </div>
        ) : filteredShows.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
            <Calendar className="w-10 h-10 text-slate-600 mx-auto" />
            <h2 className="text-base font-semibold text-white">No Scheduled Shows Found</h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No shows match the selected filters. Click &apos;Schedule Show&apos; to create screening slots.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredShows.map((show) => {
              const minP = show.pricing?.minPrice || 0;
              const maxP = show.pricing?.maxPrice || 0;
              return (
                <div
                  key={show.id}
                  className={`bg-slate-900/80 border rounded-2xl p-5 space-y-4 flex flex-col justify-between transition-all ${
                    show.isActive ? 'border-slate-800 hover:border-slate-700' : 'border-red-900/40 opacity-70'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Top Row: Movie title & Actions */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={show.movie.posterUrl || FALLBACK_POSTER}
                          alt={show.movie.title}
                          className="w-12 h-16 object-cover rounded-lg border border-slate-800 bg-slate-950 shrink-0"
                          onError={(e) => {
                            e.target.src = FALLBACK_POSTER;
                          }}
                        />
                        <div>
                          <h2 className="text-base font-bold text-white line-clamp-1">
                            {show.movie.title}
                          </h2>
                          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-400">
                            <span>{formatDuration(show.movie.duration)}</span>
                            <span>•</span>
                            <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] font-bold text-amber-400">
                              {show.movie.rating || 'UA'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditModal(show)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                          title="Edit Show"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleShowStatus(show)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                          title={show.isActive ? 'Deactivate Show' : 'Activate Show'}
                        >
                          {show.isActive ? (
                            <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                          ) : (
                            <Eye className="w-3.5 h-3.5 text-emerald-400" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Theatre & Screen Info */}
                    <div className="text-xs text-slate-300 space-y-1">
                      <p className="flex items-center gap-1 font-semibold text-slate-200">
                        <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>{show.screen.theatre.name}</span>
                        <span className="text-slate-500">({show.screen.theatre.city})</span>
                      </p>
                      <p className="text-slate-400 pl-4 text-[11px]">
                        {show.screen.name} • {show.screen.screenType}
                      </p>
                    </div>

                    {/* Timing & Format Pill */}
                    <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-1.5 text-white font-bold">
                          <Clock className="w-3.5 h-3.5 text-amber-500" />
                          <span>{formatTime(show.startTime)} – {formatTime(show.endTime)}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {formatDateTime(show.startTime).split('•')[0]}
                        </span>
                      </div>
                      <span className="px-2 py-1 rounded bg-amber-500/20 text-amber-300 font-extrabold text-xs border border-amber-500/40">
                        {show.format}
                      </span>
                    </div>

                    {/* Pricing & Availability Stats */}
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase font-bold">Price</span>
                        <span className="font-bold text-amber-400">
                          ₹{minP}{minP !== maxP ? ` – ₹${maxP}` : ''}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-slate-500 block text-[10px] uppercase font-bold">Seats</span>
                        <span className="font-bold text-emerald-400">
                          {show.availableSeats} / {show.totalSeats} free
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Schedule / Edit Show Modal */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl my-8">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-500" />
                  <span>{editingShow ? 'Edit Show Schedule' : 'Schedule New Show'}</span>
                </h2>
                <button
                  onClick={() => setModalOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {formError && (
                <div className="p-3.5 rounded-xl bg-red-950/50 border border-red-800 text-red-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleSubmitShow} className="space-y-4 text-xs">
                {/* Movie Selector */}
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Select Movie</label>
                  <select
                    disabled={!!editingShow}
                    required
                    value={formData.movieId}
                    onChange={(e) => setFormData({ ...formData, movieId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500 disabled:opacity-60"
                  >
                    <option value="">Select a Movie...</option>
                    {movies.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title} ({formatDuration(m.duration)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Theatre & Screen Selectors */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-300 block mb-1 font-semibold">Theatre</label>
                    <select
                      disabled={!!editingShow}
                      required
                      value={formData.theatreId}
                      onChange={(e) => handleModalTheatreChange(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500 disabled:opacity-60"
                    >
                      <option value="">Select Theatre...</option>
                      {theatres.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.city})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-300 block mb-1 font-semibold">Auditorium Screen</label>
                    <select
                      disabled={!!editingShow || modalScreensLoading}
                      required
                      value={formData.screenId}
                      onChange={(e) => {
                        const sid = e.target.value;
                        const scr = modalScreens.find((s) => s.id === sid);
                        setFormData({
                          ...formData,
                          screenId: sid,
                          format: scr?.supportedFormats?.[0] || '2D',
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500 disabled:opacity-60"
                    >
                      <option value="">
                        {modalScreensLoading ? 'Loading screens...' : 'Select Screen...'}
                      </option>
                      {modalScreens.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.screenType})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Format Selector */}
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Show Format</label>
                  <div className="flex flex-wrap gap-2">
                    {(selectedScreenObj?.supportedFormats || FORMAT_OPTIONS).map((f) => (
                      <button
                        type="button"
                        key={f}
                        onClick={() => setFormData({ ...formData, format: f })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          formData.format === f
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 ring-1 ring-amber-500/30'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Timing: Start Time & Buffer */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-300 block mb-1 font-semibold">Start Date &amp; Time</label>
                    <input
                      type="datetime-local"
                      required
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 block mb-1 font-semibold">Cleaning Buffer (min)</label>
                    <input
                      type="number"
                      min="0"
                      max="180"
                      value={formData.bufferMinutes}
                      onChange={(e) => setFormData({ ...formData, bufferMinutes: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Real-Time End Time Projection */}
                {projectedEndTime && (
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">
                      Automatic End Time Projection
                    </span>
                    <p className="text-xs font-semibold text-amber-400">
                      {projectedEndTime.toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                      })}{' '}
                      <span className="text-slate-500 font-normal">
                        ({selectedMovieObj?.duration || 0} min film + {formData.bufferMinutes || 0} min buffer)
                      </span>
                    </p>
                  </div>
                )}

                {/* Category-based Pricing */}
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <label className="text-slate-300 block font-semibold">
                    Category-Wise Pricing (₹)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {Object.keys(DEFAULT_PRICING).map((cat) => (
                      <div key={cat}>
                        <span className="text-[10px] text-slate-400 block font-bold mb-1">{cat}</span>
                        <div className="relative">
                          <span className="absolute left-2.5 top-2 text-slate-500 text-xs">₹</span>
                          <input
                            type="number"
                            min="1"
                            max="5000"
                            value={formData.pricing[cat] || ''}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                pricing: {
                                  ...formData.pricing,
                                  [cat]: parseFloat(e.target.value) || 0,
                                },
                              })
                            }
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-6 pr-2 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formSubmitting}
                    className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {formSubmitting ? 'Saving...' : editingShow ? 'Update Show' : 'Schedule Show'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
