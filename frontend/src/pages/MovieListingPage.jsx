import { useState, useEffect } from 'react';
import api from '../services/api';
import { MovieCard } from '../components/MovieCard';
import { Search, Film, Filter, ChevronLeft, ChevronRight, X, AlertCircle } from 'lucide-react';

export const MovieListingPage = () => {
  const [movies, setMovies] = useState([]);
  const [genres, setGenres] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 8, totalPages: 1, total: 0 });

  // Filters state
  const [search, setSearch] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load genres once on mount
  useEffect(() => {
    api.get('/genres')
      .then((res) => {
        if (res.success && res.data?.genres) {
          setGenres(res.data.genres);
        }
      })
      .catch((err) => {
        console.error('Failed to load genres:', err);
      });
  }, []);

  // Fetch movies whenever filters or page changes
  useEffect(() => {
    let isMounted = true;

    const queryParams = new URLSearchParams({
      page: pagination.page.toString(),
      limit: pagination.limit.toString(),
    });

    if (search.trim()) queryParams.set('search', search.trim());
    if (selectedGenre) queryParams.set('genre', selectedGenre);
    if (selectedLanguage) queryParams.set('language', selectedLanguage);

    api.get(`/movies?${queryParams.toString()}`)
      .then((res) => {
        if (isMounted && res.success && res.data) {
          setMovies(res.data.movies || []);
          setPagination(res.data.pagination || { page: 1, limit: 8, totalPages: 1, total: 0 });
        }
      })
      .catch((err) => {
        if (isMounted) setError(err.message || 'Failed to load movies.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [pagination.page, search, selectedGenre, selectedLanguage, pagination.limit]);

  const handleResetFilters = () => {
    setSearch('');
    setSelectedGenre('');
    setSelectedLanguage('');
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination((prev) => ({ ...prev, page: newPage }));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const hasActiveFilters = Boolean(search || selectedGenre || selectedLanguage);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Page Title & Cinema Subtitle */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-500 uppercase tracking-widest mb-1">
              <Film className="w-3.5 h-3.5" />
              <span>Now Showing in Theatres</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              Explore Movies
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Discover current theatrical releases across IMAX, Dolby Atmos and standard screens
            </p>
          </div>

          <div className="text-xs text-slate-400 font-medium">
            Showing <strong className="text-amber-400">{movies.length}</strong> of{' '}
            <strong className="text-slate-200">{pagination.total}</strong> movies
          </div>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                placeholder="Search movies by title..."
                className="w-full pl-10 pr-9 py-2 bg-slate-950/80 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Language Selector */}
            <div className="w-full sm:w-48">
              <select
                value={selectedLanguage}
                onChange={(e) => {
                  setSelectedLanguage(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="w-full py-2 px-3 bg-slate-950/80 border border-slate-700/80 rounded-xl text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 cursor-pointer"
              >
                <option value="">All Languages</option>
                <option value="English">English</option>
                <option value="Kannada">Kannada</option>
                <option value="Hindi">Hindi</option>
                <option value="Japanese">Japanese</option>
              </select>
            </div>

            {/* Reset Button */}
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 rounded-xl border border-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear Filters</span>
              </button>
            )}
          </div>

          {/* Genre Chips */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider shrink-0 flex items-center gap-1">
              <Filter className="w-3 h-3" />
              Genre:
            </span>

            <button
              onClick={() => {
                setSelectedGenre('');
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className={`text-xs font-semibold px-3 py-1 rounded-lg shrink-0 transition-all cursor-pointer ${
                selectedGenre === ''
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              }`}
            >
              All Genres
            </button>

            {genres.map((g) => {
              const isSelected = selectedGenre === g.name;
              return (
                <button
                  key={g.id}
                  onClick={() => {
                    setSelectedGenre(isSelected ? '' : g.name);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  className={`text-xs font-semibold px-3 py-1 rounded-lg shrink-0 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  {g.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Section: Loading, Error, Empty, or Movie Grid */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-4">
            <Film className="w-10 h-10 text-amber-500 animate-spin" />
            <p className="text-xs font-medium text-slate-400 tracking-wide uppercase">
              Fetching movie repertoire from database...
            </p>
          </div>
        ) : error ? (
          <div className="p-8 bg-red-950/30 border border-red-800/50 rounded-2xl flex items-center justify-center gap-3 text-red-300">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        ) : movies.length === 0 ? (
          <div className="py-16 text-center bg-slate-900/40 border border-slate-800/80 rounded-3xl p-8 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-slate-700 flex items-center justify-center text-slate-500 mx-auto">
              <Film className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-200">No Movies Match Your Criteria</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                We couldn't find any films matching your search query or selected genre and language filters.
              </p>
            </div>
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
              >
                Reset All Filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {movies.map((movie) => (
                <MovieCard key={movie.id} movie={movie} />
              ))}
            </div>

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="pt-6 border-t border-slate-800 flex items-center justify-between">
                <div className="text-xs text-slate-400">
                  Page <strong className="text-slate-200">{pagination.page}</strong> of{' '}
                  <strong className="text-slate-200">{pagination.totalPages}</strong>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                    className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((pageNum) => (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${
                        pagination.page === pageNum
                          ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                          : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      {pageNum}
                    </button>
                  ))}

                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages}
                    className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
