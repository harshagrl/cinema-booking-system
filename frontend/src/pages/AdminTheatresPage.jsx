import { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Building2,
  Tv,
  Plus,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  X,
  Search,
  ArrowLeft,
  Armchair,
  RefreshCw,
  Sparkles,
  MapPin,
} from 'lucide-react';

const SEAT_CATEGORIES = ['REGULAR', 'SILVER', 'GOLD', 'PREMIUM', 'RECLINER'];

const CATEGORY_STYLES = {
  REGULAR: {
    badge: 'bg-slate-700 text-slate-200 border-slate-600',
    seat: 'bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600',
  },
  SILVER: {
    badge: 'bg-zinc-600 text-zinc-100 border-zinc-500',
    seat: 'bg-zinc-600 border-zinc-500 text-zinc-100 hover:bg-zinc-500',
  },
  GOLD: {
    badge: 'bg-amber-600/30 text-amber-300 border-amber-500/50',
    seat: 'bg-amber-600/30 border-amber-500/70 text-amber-200 hover:bg-amber-600/50',
  },
  PREMIUM: {
    badge: 'bg-purple-600/30 text-purple-300 border-purple-500/50',
    seat: 'bg-purple-600/30 border-purple-500/70 text-purple-200 hover:bg-purple-600/50',
  },
  RECLINER: {
    badge: 'bg-emerald-600/30 text-emerald-300 border-emerald-500/50',
    seat: 'bg-emerald-600/30 border-emerald-500/70 text-emerald-200 hover:bg-emerald-600/50',
  },
};

const SCREEN_TYPES = ['STANDARD', 'IMAX', 'DOLBY_ATMOS', '4DX', 'VIP'];
const FORMAT_OPTIONS = ['2D', '3D', 'IMAX', '4DX'];

export const AdminTheatresPage = () => {
  // Navigation / drilldown state
  const [selectedTheatre, setSelectedTheatre] = useState(null);
  const [selectedScreenForSeats, setSelectedScreenForSeats] = useState(null);

  // Theatres data
  const [theatres, setTheatres] = useState([]);
  const [theatresLoading, setTheatresLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [includeInactive, setIncludeInactive] = useState(true);

  // Screens data for selected theatre
  const [screens, setScreens] = useState([]);
  const [screensLoading, setScreensLoading] = useState(false);

  // Seat layout data for selected screen
  const [seatsLoading, setSeatsLoading] = useState(false);
  const [draftSeats, setDraftSeats] = useState([]); // Array of { row, seatNumber, category, isActive }
  const [isLayoutDirty, setIsLayoutDirty] = useState(false);
  const [selectedToolCategory, setSelectedToolCategory] = useState('REGULAR');

  // Generator form
  const [genRows, setGenRows] = useState(8);
  const [genCols, setGenCols] = useState(10);
  const [genTier, setGenTier] = useState('REGULAR');

  // Feedback notifications
  const [feedback, setFeedback] = useState(null);

  // Theatre Modal
  const [theatreModalOpen, setTheatreModalOpen] = useState(false);
  const [editingTheatre, setEditingTheatre] = useState(null);
  const [theatreForm, setTheatreForm] = useState({
    name: '',
    location: '',
    city: '',
    address: '',
  });
  const [theatreSubmitting, setTheatreSubmitting] = useState(false);
  const [theatreFormError, setTheatreFormError] = useState('');

  // Screen Modal
  const [screenModalOpen, setScreenModalOpen] = useState(false);
  const [editingScreen, setEditingScreen] = useState(null);
  const [screenForm, setScreenForm] = useState({
    name: '',
    screenType: 'STANDARD',
    supportedFormats: ['2D', '3D'],
    capacity: 0,
  });
  const [screenSubmitting, setScreenSubmitting] = useState(false);
  const [screenFormError, setScreenFormError] = useState('');

  // Helper reloads
  const reloadTheatres = () => {
    const query = new URLSearchParams();
    if (includeInactive) query.set('includeInactive', 'true');
    if (searchQuery.trim()) query.set('search', searchQuery.trim());
    if (cityFilter.trim()) query.set('city', cityFilter.trim());

    api.get(`/theatres?${query.toString()}`)
      .then((res) => {
        if (res.success && res.data?.theatres) {
          setTheatres(res.data.theatres);
        }
      })
      .catch((err) => {
        setFeedback({ type: 'error', message: err.message || 'Failed to load theatres.' });
      });
  };

  const reloadScreens = (theatreId) => {
    api.get(`/theatres/${theatreId}/screens`)
      .then((res) => {
        if (res.success && res.data?.screens) {
          setScreens(res.data.screens);
        }
      })
      .catch((err) => {
        setFeedback({ type: 'error', message: err.message || 'Failed to load screens.' });
      });
  };

  const reloadSeatLayout = (screenId) => {
    api.get(`/screens/${screenId}/seats`)
      .then((res) => {
        if (res.success && res.data) {
          setDraftSeats(
            res.data.seats.map((s) => ({
              row: s.row,
              seatNumber: s.seatNumber,
              category: s.category,
              isActive: s.isActive,
            }))
          );
          setIsLayoutDirty(false);
        }
      })
      .catch((err) => {
        setFeedback({ type: 'error', message: err.message || 'Failed to load seat layout.' });
      })
      .finally(() => {
        setSeatsLoading(false);
      });
  };

  // Synchronize Theatres on mount and query changes
  useEffect(() => {
    let isMounted = true;
    const query = new URLSearchParams();
    if (includeInactive) query.set('includeInactive', 'true');
    if (searchQuery.trim()) query.set('search', searchQuery.trim());
    if (cityFilter.trim()) query.set('city', cityFilter.trim());

    api.get(`/theatres?${query.toString()}`)
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.data?.theatres) {
          setTheatres(res.data.theatres);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setFeedback({ type: 'error', message: err.message || 'Failed to load theatres.' });
        }
      })
      .finally(() => {
        if (isMounted) setTheatresLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [includeInactive, searchQuery, cityFilter]);

  // Synchronize Screens when a theatre is selected
  useEffect(() => {
    if (!selectedTheatre) return;
    let isMounted = true;

    api.get(`/theatres/${selectedTheatre.id}/screens`)
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.data?.screens) {
          setScreens(res.data.screens);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setFeedback({ type: 'error', message: err.message || 'Failed to load screens.' });
        }
      })
      .finally(() => {
        if (isMounted) setScreensLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedTheatre]);

  // Synchronize Seat Layout when a screen is selected
  useEffect(() => {
    if (!selectedScreenForSeats) return;
    let isMounted = true;

    api.get(`/screens/${selectedScreenForSeats.id}/seats`)
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.data) {
          setDraftSeats(
            res.data.seats.map((s) => ({
              row: s.row,
              seatNumber: s.seatNumber,
              category: s.category,
              isActive: s.isActive,
            }))
          );
          setIsLayoutDirty(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setFeedback({ type: 'error', message: err.message || 'Failed to load seat layout.' });
        }
      })
      .finally(() => {
        if (isMounted) setSeatsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedScreenForSeats]);

  // Auto-dismiss feedback
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // ---------------------------------------------------------------------------
  // Theatre Actions
  // ---------------------------------------------------------------------------
  const handleOpenAddTheatre = () => {
    setEditingTheatre(null);
    setTheatreForm({ name: '', location: '', city: '', address: '' });
    setTheatreFormError('');
    setTheatreModalOpen(true);
  };

  const handleOpenEditTheatre = (theatre) => {
    setEditingTheatre(theatre);
    setTheatreForm({
      name: theatre.name,
      location: theatre.location,
      city: theatre.city || '',
      address: theatre.address || '',
    });
    setTheatreFormError('');
    setTheatreModalOpen(true);
  };

  const handleSubmitTheatre = async (e) => {
    e.preventDefault();
    setTheatreFormError('');
    setTheatreSubmitting(true);

    try {
      if (editingTheatre) {
        await api.put(`/theatres/${editingTheatre.id}`, theatreForm);
        setFeedback({ type: 'success', message: 'Theatre updated successfully.' });
      } else {
        await api.post('/theatres', theatreForm);
        setFeedback({ type: 'success', message: 'Theatre created successfully.' });
      }
      setTheatreModalOpen(false);
      reloadTheatres();
    } catch (err) {
      setTheatreFormError(err.message || 'Failed to save theatre.');
    } finally {
      setTheatreSubmitting(false);
    }
  };

  const handleToggleTheatreStatus = async (theatre) => {
    const nextStatus = !theatre.isActive;
    try {
      await api.patch(`/theatres/${theatre.id}/status`, { isActive: nextStatus });
      setFeedback({
        type: 'success',
        message: `Theatre ${theatre.name} ${nextStatus ? 'activated' : 'deactivated'}.`,
      });
      reloadTheatres();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to change theatre status.' });
    }
  };

  // ---------------------------------------------------------------------------
  // Screen Actions
  // ---------------------------------------------------------------------------
  const handleOpenAddScreen = () => {
    setEditingScreen(null);
    setScreenForm({
      name: '',
      screenType: 'STANDARD',
      supportedFormats: ['2D', '3D'],
      capacity: 0,
    });
    setScreenFormError('');
    setScreenModalOpen(true);
  };

  const handleOpenEditScreen = (screen) => {
    setEditingScreen(screen);
    setScreenForm({
      name: screen.name,
      screenType: screen.screenType,
      supportedFormats: screen.supportedFormats || ['2D', '3D'],
      capacity: screen.capacity || 0,
    });
    setScreenFormError('');
    setScreenModalOpen(true);
  };

  const handleSubmitScreen = async (e) => {
    e.preventDefault();
    setScreenFormError('');
    setScreenSubmitting(true);

    try {
      if (editingScreen) {
        await api.put(`/screens/${editingScreen.id}`, screenForm);
        setFeedback({ type: 'success', message: 'Screen updated successfully.' });
      } else {
        await api.post(`/theatres/${selectedTheatre.id}/screens`, screenForm);
        setFeedback({ type: 'success', message: 'Screen created successfully.' });
      }
      setScreenModalOpen(false);
      reloadScreens(selectedTheatre.id);
      reloadTheatres();
    } catch (err) {
      setScreenFormError(err.message || 'Failed to save screen.');
    } finally {
      setScreenSubmitting(false);
    }
  };

  const handleToggleScreenStatus = async (screen) => {
    const nextStatus = !screen.isActive;
    try {
      await api.patch(`/screens/${screen.id}/status`, { isActive: nextStatus });
      setFeedback({
        type: 'success',
        message: `Screen ${screen.name} ${nextStatus ? 'activated' : 'deactivated'}.`,
      });
      reloadScreens(selectedTheatre.id);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to change screen status.' });
    }
  };

  // ---------------------------------------------------------------------------
  // Seat Layout Actions
  // ---------------------------------------------------------------------------
  const handleSeatClick = (row, seatNumber) => {
    setDraftSeats((prev) =>
      prev.map((s) => {
        if (s.row === row && s.seatNumber === seatNumber) {
          // If clicking seat, set to current tool category, or toggle active if same category
          if (s.category === selectedToolCategory) {
            return { ...s, isActive: !s.isActive };
          }
          return { ...s, category: selectedToolCategory, isActive: true };
        }
        return s;
      })
    );
    setIsLayoutDirty(true);
  };

  const handleGenerateGrid = () => {
    const newSeats = [];
    const numRows = Math.min(Math.max(1, parseInt(genRows, 10) || 1), 26);
    const numCols = Math.min(Math.max(1, parseInt(genCols, 10) || 1), 50);

    for (let r = 0; r < numRows; r++) {
      const rowLetter = String.fromCharCode(65 + r); // A, B, C...
      for (let c = 1; c <= numCols; c++) {
        newSeats.push({
          row: rowLetter,
          seatNumber: c,
          category: genTier,
          isActive: true,
        });
      }
    }

    setDraftSeats(newSeats);
    setIsLayoutDirty(true);
    setFeedback({
      type: 'success',
      message: `Generated grid with ${newSeats.length} seats (${numRows} rows × ${numCols} seats). Click 'Save Configuration' to commit.`,
    });
  };

  const handleSaveSeatConfiguration = async () => {
    if (!selectedScreenForSeats) return;
    setSeatsLoading(true);

    try {
      await api.post(`/screens/${selectedScreenForSeats.id}/seats`, {
        seats: draftSeats,
      });
      setFeedback({
        type: 'success',
        message: `Seat layout updated successfully (${draftSeats.length} physical seats).`,
      });
      setIsLayoutDirty(false);
      reloadSeatLayout(selectedScreenForSeats.id);
      reloadScreens(selectedTheatre.id);
    } catch (err) {
      const msg =
        err.code === 'SEAT_REFERENCED_IN_SHOWS'
          ? 'Cannot delete seats referenced in existing shows. To block broken seats, mark them as Inactive instead.'
          : err.message || 'Failed to update seat configuration.';
      setFeedback({ type: 'error', message: msg });
      setSeatsLoading(false);
    }
  };

  // Group draft seats by row
  const rowsMap = draftSeats.reduce((acc, s) => {
    if (!acc[s.row]) acc[s.row] = [];
    acc[s.row].push(s);
    return acc;
  }, {});

  const sortedRows = Object.keys(rowsMap)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((rowName) => ({
      row: rowName,
      seats: rowsMap[rowName].sort((a, b) => a.seatNumber - b.seatNumber),
    }));

  const draftCategoryCounts = draftSeats.reduce((acc, s) => {
    if (s.isActive) {
      acc[s.category] = (acc[s.category] || 0) + 1;
    }
    return acc;
  }, {});

  // ---------------------------------------------------------------------------
  // Render Seat Layout Designer View
  // ---------------------------------------------------------------------------
  if (selectedScreenForSeats) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Breadcrumb / Top Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedScreenForSeats(null)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:bg-slate-800 transition-colors text-slate-300"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Screens
              </button>
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <Armchair className="w-5 h-5 text-amber-500" />
                  <span>Physical Seat Designer: {selectedScreenForSeats.name}</span>
                </h1>
                <p className="text-xs text-slate-400">
                  {selectedTheatre.name} • {selectedTheatre.city} • Capacity: {draftSeats.length} seats
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isLayoutDirty && (
                <span className="text-xs text-amber-400 font-semibold px-2 py-1 rounded bg-amber-950/60 border border-amber-800/60">
                  Unsaved Changes
                </span>
              )}
              <button
                onClick={handleSaveSeatConfiguration}
                disabled={seatsLoading || !isLayoutDirty}
                className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 disabled:opacity-50 transition-all shadow-md shadow-amber-500/20"
              >
                {seatsLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Save Configuration
              </button>
            </div>
          </div>

          {/* Alert feedback */}
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

          {/* Quick Layout Generator & Tier Palette */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Tool / Category Selection */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h2 className="text-xs uppercase font-extrabold tracking-wider text-slate-400 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Category Paint Tool
              </h2>
              <p className="text-xs text-slate-400">
                Select a category below, then click any seat on the grid to change its tier. Clicking a seat of the same tier toggles its active/inactive status.
              </p>
              <div className="flex flex-wrap gap-2">
                {SEAT_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedToolCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      selectedToolCategory === cat
                        ? `${CATEGORY_STYLES[cat].badge} ring-2 ring-white/40 shadow-sm scale-105`
                        : `${CATEGORY_STYLES[cat].badge} opacity-60 hover:opacity-100`
                    }`}
                  >
                    {cat} ({draftCategoryCounts[cat] || 0})
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Grid Generator */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3 lg:col-span-2">
              <h2 className="text-xs uppercase font-extrabold tracking-wider text-slate-400 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Fast Layout Generator
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Rows (1-26)</label>
                  <input
                    type="number"
                    min="1"
                    max="26"
                    value={genRows}
                    onChange={(e) => setGenRows(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Seats/Row (1-50)</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={genCols}
                    onChange={(e) => setGenCols(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Default Tier</label>
                  <select
                    value={genTier}
                    onChange={(e) => setGenTier(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  >
                    {SEAT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleGenerateGrid}
                    className="w-full text-xs font-semibold px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition-colors"
                  >
                    Generate Grid
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Cinema Hall Screen & Layout Visualizer */}
          <div className="bg-slate-900/60 border border-slate-800/90 rounded-2xl p-6 sm:p-10 space-y-8 flex flex-col items-center overflow-x-auto">
            {/* Curved Screen Banner */}
            <div className="w-full max-w-2xl flex flex-col items-center">
              <div className="w-full h-3 bg-gradient-to-r from-transparent via-amber-500/80 to-transparent rounded-full blur-[1px] shadow-lg shadow-amber-500/30"></div>
              <div className="w-3/4 h-2 bg-gradient-to-r from-transparent via-slate-400/60 to-transparent rounded-full mt-1"></div>
              <span className="text-[10px] tracking-[0.3em] font-extrabold uppercase text-slate-500 mt-2">
                Cinema Screen Display
              </span>
            </div>

            {/* Seat Grid */}
            <div className="space-y-2.5 py-4 min-w-max">
              {sortedRows.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  No seats configured yet. Use the Fast Layout Generator above to create rows.
                </div>
              ) : (
                sortedRows.map((rowGroup) => (
                  <div key={rowGroup.row} className="flex items-center gap-2">
                    <span className="w-6 text-center text-xs font-bold text-slate-400 select-none">
                      {rowGroup.row}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {rowGroup.seats.map((seat) => (
                        <button
                          key={`${seat.row}-${seat.seatNumber}`}
                          onClick={() => handleSeatClick(seat.row, seat.seatNumber)}
                          title={`Row ${seat.row}, Seat ${seat.seatNumber} (${seat.category})${!seat.isActive ? ' - INACTIVE' : ''}`}
                          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-[10px] sm:text-xs font-semibold flex items-center justify-center border transition-all cursor-pointer ${
                            !seat.isActive
                              ? 'bg-slate-950/80 border-slate-800 text-slate-600 line-through'
                              : CATEGORY_STYLES[seat.category]?.seat || 'bg-slate-700 text-slate-200'
                          }`}
                        >
                          {seat.seatNumber}
                        </button>
                      ))}
                    </div>
                    <span className="w-6 text-center text-xs font-bold text-slate-400 select-none">
                      {rowGroup.row}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center justify-center gap-4 pt-4 border-t border-slate-800/80 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 rounded bg-slate-700 border border-slate-600"></div>
                <span>Regular</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 rounded bg-zinc-600 border border-zinc-500"></div>
                <span>Silver</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 rounded bg-amber-600/30 border border-amber-500/70"></div>
                <span>Gold</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 rounded bg-purple-600/30 border border-purple-500/70"></div>
                <span>Premium</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 rounded bg-emerald-600/30 border border-emerald-500/70"></div>
                <span>Recliner</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 rounded bg-slate-950 border border-slate-800 text-slate-600 flex items-center justify-center text-[9px] font-bold">
                  ✕
                </div>
                <span>Blocked / Inactive</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render Screens View for Selected Theatre
  // ---------------------------------------------------------------------------
  if (selectedTheatre) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedTheatre(null)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:bg-slate-800 transition-colors text-slate-300"
              >
                <ArrowLeft className="w-4 h-4" />
                All Theatres
              </button>
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Tv className="w-6 h-6 text-amber-500" />
                  <span>Screens in {selectedTheatre.name}</span>
                </h1>
                <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  {selectedTheatre.location}, {selectedTheatre.city}
                </p>
              </div>
            </div>

            <button
              onClick={handleOpenAddScreen}
              className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 transition-all self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              Add Screen
            </button>
          </div>

          {/* Feedback */}
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

          {/* Screens List */}
          {screensLoading ? (
            <div className="flex items-center justify-center py-16 text-slate-400 text-xs gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
              Loading screens...
            </div>
          ) : screens.length === 0 ? (
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
              <Tv className="w-10 h-10 text-slate-600 mx-auto" />
              <h2 className="text-base font-semibold text-white">No Screens Configured</h2>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                This theatre doesn&apos;t have any screens yet. Click &apos;Add Screen&apos; to configure auditoriums and their seat layouts.
              </p>
              <button
                onClick={handleOpenAddScreen}
                className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Add First Screen
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {screens.map((screen) => (
                <div
                  key={screen.id}
                  className={`bg-slate-900/80 border rounded-2xl p-5 space-y-4 transition-all ${
                    screen.isActive ? 'border-slate-800 hover:border-slate-700' : 'border-red-900/40 opacity-70'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-base font-bold text-white flex items-center gap-2">
                        {screen.name}
                        {!screen.isActive && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-950/60 text-red-400 border border-red-800/60">
                            INACTIVE
                          </span>
                        )}
                      </h2>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-950/40 text-amber-400 border border-amber-800/40 inline-block mt-1">
                        {screen.screenType}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditScreen(screen)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        title="Edit Screen"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleScreenStatus(screen)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        title={screen.isActive ? 'Deactivate Screen' : 'Activate Screen'}
                      >
                        {screen.isActive ? (
                          <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                        ) : (
                          <Eye className="w-3.5 h-3.5 text-emerald-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Formats & Stats */}
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Supported Formats:</span>
                      <div className="flex items-center gap-1">
                        {screen.supportedFormats?.map((f) => (
                          <span
                            key={f}
                            className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-slate-300 border border-slate-700"
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Total Capacity:</span>
                      <span className="font-semibold text-white">{screen.capacity || 0} seats</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Physical Seats Registered:</span>
                      <span className="font-semibold text-white">{screen.totalSeats || 0}</span>
                    </div>
                  </div>

                  {/* Seat Designer Action Button */}
                  <button
                    onClick={() => setSelectedScreenForSeats(screen)}
                    className="w-full flex items-center justify-center gap-2 text-xs font-bold py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 transition-all cursor-pointer"
                  >
                    <Armchair className="w-3.5 h-3.5" />
                    Configure Physical Seat Layout
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add/Edit Screen Modal */}
          {screenModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h2 className="text-base font-bold text-white">
                    {editingScreen ? 'Edit Screen' : 'Add New Screen'}
                  </h2>
                  <button
                    onClick={() => setScreenModalOpen(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {screenFormError && (
                  <div className="p-3 rounded-lg bg-red-950/50 border border-red-800 text-red-300 text-xs">
                    {screenFormError}
                  </div>
                )}

                <form onSubmit={handleSubmitScreen} className="space-y-4 text-xs">
                  <div>
                    <label className="text-slate-300 block mb-1 font-semibold">Screen Name / Number</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Audi 1 (Dolby Atmos)"
                      value={screenForm.name}
                      onChange={(e) => setScreenForm({ ...screenForm, name: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 block mb-1 font-semibold">Screen Type</label>
                    <select
                      value={screenForm.screenType}
                      onChange={(e) => setScreenForm({ ...screenForm, screenType: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    >
                      {SCREEN_TYPES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-300 block mb-1 font-semibold">Supported Screening Formats</label>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {FORMAT_OPTIONS.map((format) => {
                        const checked = screenForm.supportedFormats.includes(format);
                        return (
                          <button
                            type="button"
                            key={format}
                            onClick={() => {
                              if (checked) {
                                if (screenForm.supportedFormats.length > 1) {
                                  setScreenForm({
                                    ...screenForm,
                                    supportedFormats: screenForm.supportedFormats.filter((f) => f !== format),
                                  });
                                }
                              } else {
                                setScreenForm({
                                  ...screenForm,
                                  supportedFormats: [...screenForm.supportedFormats, format],
                                });
                              }
                            }}
                            className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-all ${
                              checked
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                                : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
                            }`}
                          >
                            {format}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-300 block mb-1 font-semibold">
                      Initial Capacity (auto-updated when configuring seats)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={screenForm.capacity}
                      onChange={(e) =>
                        setScreenForm({ ...screenForm, capacity: parseInt(e.target.value, 10) || 0 })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setScreenModalOpen(false)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={screenSubmitting}
                      className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-all disabled:opacity-50"
                    >
                      {screenSubmitting ? 'Saving...' : editingScreen ? 'Update Screen' : 'Create Screen'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render Theatres List View (Default)
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Theatres &amp; Screens Management
              </h1>
              <p className="text-xs text-slate-400">
                Configure multiplexes, auditoriums, and physical seat layouts
              </p>
            </div>
          </div>

          <button
            onClick={handleOpenAddTheatre}
            className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 transition-all self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Add Theatre
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
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
          <div className="flex flex-1 items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">
            <Search className="w-4 h-4 text-slate-500 shrink-0" />
            <input
              type="text"
              placeholder="Search theatre name, location or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-white focus:outline-none placeholder:text-slate-600 text-xs"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Filter by city..."
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none placeholder:text-slate-600 text-xs w-36"
            />

            <label className="flex items-center gap-2 text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
                className="rounded border-slate-700 text-amber-500 focus:ring-0"
              />
              <span className="text-xs">Include Inactive</span>
            </label>
          </div>
        </div>

        {/* Theatres Grid */}
        {theatresLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-xs gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
            Loading theatres...
          </div>
        ) : theatres.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
            <Building2 className="w-10 h-10 text-slate-600 mx-auto" />
            <h2 className="text-base font-semibold text-white">No Theatres Found</h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No theatres match your query. Add a new cinema multiplex or adjust your search filters.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {theatres.map((theatre) => (
              <div
                key={theatre.id}
                className={`bg-slate-900/80 border rounded-2xl p-5 space-y-4 flex flex-col justify-between transition-all ${
                  theatre.isActive ? 'border-slate-800 hover:border-slate-700' : 'border-red-900/40 opacity-70'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-base font-bold text-white flex items-center gap-2">
                        {theatre.name}
                        {!theatre.isActive && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-950/60 text-red-400 border border-red-800/60">
                            INACTIVE
                          </span>
                        )}
                      </h2>
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>{theatre.city || 'City N/A'}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditTheatre(theatre)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        title="Edit Theatre"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleTheatreStatus(theatre)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        title={theatre.isActive ? 'Deactivate Theatre' : 'Activate Theatre'}
                      >
                        {theatre.isActive ? (
                          <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                        ) : (
                          <Eye className="w-3.5 h-3.5 text-emerald-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-2">
                    {theatre.address || theatre.location}
                  </p>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                    <div>
                      <span>Screens: </span>
                      <span className="font-bold text-white">
                        {theatre.activeScreensCount} / {theatre.screensCount}
                      </span>
                    </div>
                    <div>
                      <span>Total Capacity: </span>
                      <span className="font-bold text-amber-400">{theatre.totalCapacity || 0}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedTheatre(theatre)}
                  className="w-full flex items-center justify-center gap-2 text-xs font-bold py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 transition-all cursor-pointer"
                >
                  <Tv className="w-3.5 h-3.5" />
                  Manage Screens ({theatre.screensCount})
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add/Edit Theatre Modal */}
        {theatreModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 className="text-base font-bold text-white">
                  {editingTheatre ? 'Edit Theatre' : 'Add New Theatre'}
                </h2>
                <button
                  onClick={() => setTheatreModalOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {theatreFormError && (
                <div className="p-3 rounded-lg bg-red-950/50 border border-red-800 text-red-300 text-xs">
                  {theatreFormError}
                </div>
              )}

              <form onSubmit={handleSubmitTheatre} className="space-y-4 text-xs">
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Theatre Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Algions Cineplex Forum"
                    value={theatreForm.name}
                    onChange={(e) => setTheatreForm({ ...theatreForm, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">City</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Bengaluru"
                    value={theatreForm.city}
                    onChange={(e) => setTheatreForm({ ...theatreForm, city: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Location / Area</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Koramangala 7th Block"
                    value={theatreForm.location}
                    onChange={(e) => setTheatreForm({ ...theatreForm, location: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Full Address</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Level 4, Forum Mall, Hosur Road, Koramangala"
                    value={theatreForm.address}
                    onChange={(e) => setTheatreForm({ ...theatreForm, address: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setTheatreModalOpen(false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={theatreSubmitting}
                    className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-all disabled:opacity-50"
                  >
                    {theatreSubmitting ? 'Saving...' : editingTheatre ? 'Update Theatre' : 'Create Theatre'}
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
