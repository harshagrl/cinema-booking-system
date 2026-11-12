import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { formatDuration, formatDate, FALLBACK_POSTER } from '../utils/formatters';
import { ArrowLeft, Clock, Calendar, Film, AlertCircle, Ticket, CheckCircle2 } from 'lucide-react';

export const MovieDetailsPage = () => {
  const { id } = useParams();
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [imgSrc, setImgSrc] = useState(FALLBACK_POSTER);

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

              {/* Showtimes & Booking Teaser */}
              <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                  <Ticket className="w-4 h-4" />
                  <span>Theatrical Screenings</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Scheduled showtimes and interactive seat reservation for <strong>{movie.title}</strong> will be unlocked in upcoming Module 5 & 6.
                </p>
                <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Real database movie record synchronized with Algions Cineplex database</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
