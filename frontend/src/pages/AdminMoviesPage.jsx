import { useState, useEffect } from 'react';
import api from '../services/api';
import { formatDuration } from '../utils/formatters';
import {
  Film,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  X,
  Search,
  Layers,
} from 'lucide-react';

export const AdminMoviesPage = () => {
  const [activeTab, setActiveTab] = useState('movies'); // 'movies' | 'genres'

  // Data states
  const [movies, setMovies] = useState([]);
  const [genres, setGenres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'inactive'
  const [movieSearch, setMovieSearch] = useState('');

  // Alerts
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: string }

  // Movie Modal state
  const [movieModalOpen, setMovieModalOpen] = useState(false);
  const [editingMovie, setEditingMovie] = useState(null); // null = Add, object = Edit
  const [movieForm, setMovieForm] = useState({
    title: '',
    description: '',
    duration: 120,
    language: 'English',
    rating: 'UA',
    releaseDate: '',
    posterUrl: '',
    genreIds: [],
  });
  const [movieFormError, setMovieFormError] = useState('');
  const [movieSubmitting, setMovieSubmitting] = useState(false);

  // Genre Modal / Input state
  const [newGenreName, setNewGenreName] = useState('');
  const [editingGenre, setEditingGenre] = useState(null); // { id, name }
  const [genreSubmitting, setGenreSubmitting] = useState(false);
  const [genreError, setGenreError] = useState('');

  // Load genres
  const fetchGenres = () => {
    api.get('/genres')
      .then((res) => {
        if (res.success && res.data?.genres) {
          setGenres(res.data.genres);
        }
      })
      .catch((err) => {
        console.error('Failed to load genres:', err);
      });
  };

  // Load movies (including inactive)
  const fetchMovies = () => {
    api.get('/movies?includeInactive=true&limit=50')
      .then((res) => {
        if (res.success && res.data?.movies) {
          setMovies(res.data.movies);
        }
      })
      .catch((err) => {
        setFeedback({ type: 'error', message: err.message || 'Failed to load movies.' });
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      api.get('/genres'),
      api.get('/movies?includeInactive=true&limit=50'),
    ])
      .then(([genresRes, moviesRes]) => {
        if (!isMounted) return;
        if (genresRes.success && genresRes.data?.genres) {
          setGenres(genresRes.data.genres);
        }
        if (moviesRes.success && moviesRes.data?.movies) {
          setMovies(moviesRes.data.movies);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setFeedback({ type: 'error', message: err.message || 'Failed to load initial data.' });
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Open Add Movie Modal
  const handleOpenAddMovie = () => {
    setEditingMovie(null);
    setMovieForm({
      title: '',
      description: '',
      duration: 120,
      language: 'English',
      rating: 'UA',
      releaseDate: '',
      posterUrl: '',
      genreIds: [],
    });
    setMovieFormError('');
    setMovieModalOpen(true);
  };

  // Open Edit Movie Modal
  const handleOpenEditMovie = (movie) => {
    setEditingMovie(movie);
    setMovieForm({
      title: movie.title,
      description: movie.description,
      duration: movie.duration,
      language: movie.language,
      rating: movie.rating || 'UA',
      releaseDate: movie.releaseDate ? movie.releaseDate.split('T')[0] : '',
      posterUrl: movie.posterUrl || '',
      genreIds: movie.genres.map((g) => g.id),
    });
    setMovieFormError('');
    setMovieModalOpen(true);
  };

  // Toggle Genre in Movie Form
  const toggleGenreSelection = (genreId) => {
    setMovieForm((prev) => {
      const exists = prev.genreIds.includes(genreId);
      return {
        ...prev,
        genreIds: exists
          ? prev.genreIds.filter((id) => id !== genreId)
          : [...prev.genreIds, genreId],
      };
    });
  };

  // Submit Movie (Create or Update)
  const handleMovieSubmit = async (e) => {
    e.preventDefault();
    setMovieFormError('');

    if (movieForm.genreIds.length === 0) {
      setMovieFormError('Please select at least one genre for the movie.');
      return;
    }

    try {
      setMovieSubmitting(true);
      const payload = {
        ...movieForm,
        duration: Number(movieForm.duration),
        releaseDate: movieForm.releaseDate ? movieForm.releaseDate : null,
      };

      if (editingMovie) {
        await api.put(`/movies/${editingMovie.id}`, payload);
        setFeedback({ type: 'success', message: `Movie '${payload.title}' updated successfully!` });
      } else {
        await api.post('/movies', payload);
        setFeedback({ type: 'success', message: `Movie '${payload.title}' created successfully!` });
      }

      setMovieModalOpen(false);
      fetchMovies();
      fetchGenres();
    } catch (err) {
      setMovieFormError(err.message || 'Operation failed. Please verify input data.');
    } finally {
      setMovieSubmitting(false);
    }
  };

  // Toggle Movie Active/Inactive Status
  const handleToggleStatus = async (movie) => {
    try {
      const nextStatus = !movie.isActive;
      await api.patch(`/movies/${movie.id}/status`, { isActive: nextStatus });
      setFeedback({
        type: 'success',
        message: `Movie '${movie.title}' is now ${nextStatus ? 'Active' : 'Inactive'}.`,
      });
      fetchMovies();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update movie status.' });
    }
  };

  // Create Genre
  const handleCreateGenre = async (e) => {
    e.preventDefault();
    setGenreError('');
    if (!newGenreName.trim()) return;

    try {
      setGenreSubmitting(true);
      await api.post('/genres', { name: newGenreName.trim() });
      setFeedback({ type: 'success', message: `Genre '${newGenreName.trim()}' added successfully!` });
      setNewGenreName('');
      fetchGenres();
    } catch (err) {
      setGenreError(err.message || 'Failed to add genre.');
    } finally {
      setGenreSubmitting(false);
    }
  };

  // Update Genre
  const handleUpdateGenre = async (e) => {
    e.preventDefault();
    if (!editingGenre || !editingGenre.name.trim()) return;

    try {
      setGenreSubmitting(true);
      await api.put(`/genres/${editingGenre.id}`, { name: editingGenre.name.trim() });
      setFeedback({ type: 'success', message: `Genre renamed to '${editingGenre.name.trim()}'.` });
      setEditingGenre(null);
      fetchGenres();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to rename genre.' });
    } finally {
      setGenreSubmitting(false);
    }
  };

  // Delete Genre
  const handleDeleteGenre = async (genre) => {
    if (genre.movieCount > 0) {
      setFeedback({
        type: 'error',
        message: `Cannot delete genre '${genre.name}'. It is associated with ${genre.movieCount} movie(s). Remove associations first.`,
      });
      return;
    }

    if (!window.confirm(`Are you sure you want to delete the genre '${genre.name}'?`)) {
      return;
    }

    try {
      await api.delete(`/genres/${genre.id}`);
      setFeedback({ type: 'success', message: `Genre '${genre.name}' deleted successfully!` });
      fetchGenres();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to delete genre.' });
    }
  };

  // Filtered movies
  const filteredMovies = movies.filter((m) => {
    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'active'
        ? m.isActive
        : !m.isActive;

    const matchesSearch = movieSearch.trim()
      ? m.title.toLowerCase().includes(movieSearch.trim().toLowerCase()) ||
        m.language.toLowerCase().includes(movieSearch.trim().toLowerCase())
      : true;

    return matchesStatus && matchesSearch;
  });

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-400 uppercase tracking-widest mb-1">
              <Film className="w-3.5 h-3.5" />
              <span>Cinema Content Operations</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Movie & Genre Management
            </h1>
          </div>

          {/* Action Tabs */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('movies')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === 'movies'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              <span>Movies ({movies.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('genres')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === 'genres'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Genres ({genres.length})</span>
            </button>
          </div>
        </div>

        {/* Global Feedback Banner */}
        {feedback && (
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-medium animate-fadeIn ${
              feedback.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                : 'bg-red-950/40 border-red-800/60 text-red-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-slate-400 hover:text-slate-200 p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 1: MOVIES MANAGEMENT                                       */}
        {/* ============================================================== */}
        {activeTab === 'movies' && (
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl">
              <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
                {/* Search */}
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={movieSearch}
                    onChange={(e) => setMovieSearch(e.target.value)}
                    placeholder="Search titles or languages..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                {/* Status Filter */}
                <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 p-1 rounded-xl w-full sm:w-auto">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                      statusFilter === 'all'
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    All ({movies.length})
                  </button>
                  <button
                    onClick={() => setStatusFilter('active')}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                      statusFilter === 'active'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Active ({movies.filter((m) => m.isActive).length})
                  </button>
                  <button
                    onClick={() => setStatusFilter('inactive')}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                      statusFilter === 'inactive'
                        ? 'bg-red-950 text-red-300 border border-red-800/60'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Inactive ({movies.filter((m) => !m.isActive).length})
                  </button>
                </div>
              </div>

              {/* Add Movie Action */}
              <button
                onClick={handleOpenAddMovie}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md shadow-amber-500/10 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add New Movie</span>
              </button>
            </div>

            {/* Movies Table */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              {loading ? (
                <div className="py-16 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Film className="w-5 h-5 text-amber-500 animate-spin" />
                  <span>Loading cinema movie inventory...</span>
                </div>
              ) : filteredMovies.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                  <Film className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="font-semibold text-slate-300">No movies match your filter.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Movie</th>
                        <th className="py-3 px-4">Duration & Language</th>
                        <th className="py-3 px-4">Genres</th>
                        <th className="py-3 px-4">Rating</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {filteredMovies.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-800/40 transition-colors">
                          {/* Title & Poster */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-13 rounded-lg overflow-hidden bg-slate-950 shrink-0 border border-slate-800">
                                {m.posterUrl ? (
                                  <img
                                    src={m.posterUrl}
                                    alt={m.title}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-slate-600">
                                    <Film className="w-4 h-4" />
                                  </div>
                                )}
                              </div>
                              <div>
                                <span className="font-bold text-slate-100 block">{m.title}</span>
                                <span className="text-[10px] font-mono text-slate-500">{m.id.slice(0, 8)}...</span>
                              </div>
                            </div>
                          </td>

                          {/* Duration & Language */}
                          <td className="py-3 px-4">
                            <span className="font-semibold text-slate-200 block">{formatDuration(m.duration)}</span>
                            <span className="text-slate-400 text-[11px]">{m.language}</span>
                          </td>

                          {/* Genres */}
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {m.genres?.map((g) => (
                                <span
                                  key={g.id}
                                  className="text-[10px] px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300"
                                >
                                  {g.name}
                                </span>
                              ))}
                            </div>
                          </td>

                          {/* Rating */}
                          <td className="py-3 px-4">
                            <span className="font-mono font-bold text-amber-400 bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded text-[10px]">
                              {m.rating || 'UA'}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${
                                m.isActive
                                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                                  : 'bg-red-950/80 text-red-300 border-red-700/60'
                              }`}
                            >
                              {m.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                onClick={() => handleOpenEditMovie(m)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                                title="Edit Movie"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleToggleStatus(m)}
                                className={`p-1.5 rounded-lg border transition-colors ${
                                  m.isActive
                                    ? 'bg-slate-800 hover:bg-red-950/60 text-slate-400 hover:text-red-400 border-slate-700 hover:border-red-800'
                                    : 'bg-slate-800 hover:bg-emerald-950/60 text-slate-400 hover:text-emerald-400 border-slate-700 hover:border-emerald-800'
                                }`}
                                title={m.isActive ? 'Deactivate Movie' : 'Activate Movie'}
                              >
                                {m.isActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: GENRE MANAGEMENT                                        */}
        {/* ============================================================== */}
        {activeTab === 'genres' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Add Genre Card */}
            <div className="md:col-span-1 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4 h-fit">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-500" />
                <span>Add New Genre</span>
              </h2>

              {genreError && (
                <div className="p-2.5 rounded-lg bg-red-950/40 border border-red-800/50 text-red-300 text-xs">
                  {genreError}
                </div>
              )}

              <form onSubmit={handleCreateGenre} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Genre Name</label>
                  <input
                    type="text"
                    required
                    value={newGenreName}
                    onChange={(e) => setNewGenreName(e.target.value)}
                    placeholder="e.g. Documentary, Fantasy"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={genreSubmitting || !newGenreName.trim()}
                  className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {genreSubmitting ? 'Creating...' : 'Create Genre'}
                </button>
              </form>
            </div>

            {/* Genre List Table */}
            <div className="md:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                  Configured Genres ({genres.length})
                </h3>
              </div>

              <div className="divide-y divide-slate-800/80">
                {genres.map((g) => (
                  <div
                    key={g.id}
                    className="p-3.5 px-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors"
                  >
                    {editingGenre?.id === g.id ? (
                      <form onSubmit={handleUpdateGenre} className="flex items-center gap-2 flex-1 mr-2">
                        <input
                          type="text"
                          required
                          value={editingGenre.name}
                          onChange={(e) =>
                            setEditingGenre((prev) => ({ ...prev, name: e.target.value }))
                          }
                          className="px-2.5 py-1 bg-slate-950 border border-amber-500 rounded-lg text-xs text-white flex-1"
                        />
                        <button
                          type="submit"
                          className="px-2.5 py-1 bg-amber-500 text-slate-950 font-bold text-xs rounded-lg"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingGenre(null)}
                          className="px-2.5 py-1 bg-slate-800 text-slate-400 text-xs rounded-lg"
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-slate-100 text-xs">{g.name}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400">
                            {g.movieCount} movie{g.movieCount === 1 ? '' : 's'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setEditingGenre({ id: g.id, name: g.name })}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700"
                            title="Rename Genre"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteGenre(g)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-950/60 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-800"
                            title={
                              g.movieCount > 0
                                ? 'Cannot delete: Associated with existing movies'
                                : 'Delete Genre'
                            }
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* ADD / EDIT MOVIE MODAL                                         */}
        {/* ============================================================== */}
        {movieModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5 my-8">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Film className="w-4 h-4 text-amber-500" />
                  <span>{editingMovie ? 'Edit Movie Details' : 'Add New Movie to Repertoire'}</span>
                </h3>
                <button
                  onClick={() => setMovieModalOpen(false)}
                  className="text-slate-400 hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {movieFormError && (
                <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-red-300 text-xs">
                  {movieFormError}
                </div>
              )}

              <form onSubmit={handleMovieSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Movie Title *</label>
                  <input
                    type="text"
                    required
                    value={movieForm.title}
                    onChange={(e) => setMovieForm({ ...movieForm, title: e.target.value })}
                    placeholder="e.g. Oppenheimer"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">Synopsis / Description *</label>
                  <textarea
                    rows={3}
                    required
                    value={movieForm.description}
                    onChange={(e) => setMovieForm({ ...movieForm, description: e.target.value })}
                    placeholder="Brief synopsis of the film..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-medium text-slate-300 mb-1">Duration (Mins) *</label>
                    <input
                      type="number"
                      required
                      min={15}
                      max={360}
                      value={movieForm.duration}
                      onChange={(e) => setMovieForm({ ...movieForm, duration: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-300 mb-1">Language *</label>
                    <input
                      type="text"
                      required
                      value={movieForm.language}
                      onChange={(e) => setMovieForm({ ...movieForm, language: e.target.value })}
                      placeholder="English, Kannada, etc."
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-300 mb-1">Rating</label>
                    <input
                      type="text"
                      value={movieForm.rating}
                      onChange={(e) => setMovieForm({ ...movieForm, rating: e.target.value })}
                      placeholder="UA, U, A"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-300 mb-1">Release Date</label>
                    <input
                      type="date"
                      value={movieForm.releaseDate}
                      onChange={(e) => setMovieForm({ ...movieForm, releaseDate: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-300 mb-1">Poster Image URL</label>
                    <input
                      type="url"
                      value={movieForm.posterUrl}
                      onChange={(e) => setMovieForm({ ...movieForm, posterUrl: e.target.value })}
                      placeholder="https://..."
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>

                {/* Genre Checkboxes */}
                <div>
                  <label className="block font-medium text-slate-300 mb-1.5">
                    Associated Genres (Select at least 1) *
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-950/70 p-3 rounded-xl border border-slate-800 max-h-36 overflow-y-auto">
                    {genres.map((g) => {
                      const isChecked = movieForm.genreIds.includes(g.id);
                      return (
                        <label
                          key={g.id}
                          className={`flex items-center gap-2 p-1.5 rounded-lg border text-[11px] cursor-pointer transition-colors ${
                            isChecked
                              ? 'bg-amber-950/60 border-amber-600/70 text-amber-200'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleGenreSelection(g.id)}
                            className="rounded border-slate-700 text-amber-500 focus:ring-0 cursor-pointer"
                          />
                          <span className="truncate">{g.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setMovieModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={movieSubmitting}
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-lg transition-all cursor-pointer disabled:opacity-50"
                  >
                    {movieSubmitting ? 'Saving Movie...' : editingMovie ? 'Update Movie' : 'Create Movie'}
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
