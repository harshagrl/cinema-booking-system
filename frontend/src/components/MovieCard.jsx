import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Film, ArrowRight } from 'lucide-react';
import { formatDuration, FALLBACK_POSTER } from '../utils/formatters';

export const MovieCard = ({ movie }) => {
  const [imgSrc, setImgSrc] = useState(movie.posterUrl || FALLBACK_POSTER);

  const getRatingBadge = (rating) => {
    switch (rating?.toUpperCase()) {
      case 'U':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60';
      case 'A':
        return 'bg-red-950/80 text-red-300 border-red-700/60';
      default:
        return 'bg-amber-950/80 text-amber-300 border-amber-700/60';
    }
  };

  return (
    <div className="group relative bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl hover:border-slate-700 hover:-translate-y-1 transition-all duration-300 flex flex-col">
      {/* Poster Image with Badges */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-slate-950">
        <img
          src={imgSrc}
          alt={movie.title}
          onError={() => setImgSrc(FALLBACK_POSTER)}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent opacity-80 group-hover:opacity-60 transition-opacity" />

        {/* Top Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
          {movie.rating && (
            <span
              className={`text-[10px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-md border backdrop-blur-md ${getRatingBadge(
                movie.rating
              )}`}
            >
              {movie.rating}
            </span>
          )}

          <span className="text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded-md bg-slate-900/90 text-slate-200 border border-slate-700/70 backdrop-blur-md">
            {movie.language}
          </span>
        </div>

        {/* Inactive Badge (if viewing inactive) */}
        {!movie.isActive && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <span className="px-3 py-1 bg-red-900/90 text-red-200 border border-red-700 text-xs font-bold uppercase tracking-wider rounded-lg shadow-lg">
              Currently Inactive
            </span>
          </div>
        )}
      </div>

      {/* Movie Details */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div>
          <h3 className="text-base font-bold text-slate-100 group-hover:text-amber-400 transition-colors line-clamp-1">
            {movie.title}
          </h3>

          {/* Meta Info */}
          <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>{formatDuration(movie.duration)}</span>
            </div>
          </div>

          {/* Genre Tags */}
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {movie.genres?.slice(0, 3).map((g) => (
              <span
                key={g.id}
                className="text-[10px] font-medium bg-slate-800/80 text-slate-300 border border-slate-700/60 px-2 py-0.5 rounded-md"
              >
                {g.name}
              </span>
            ))}
            {movie.genres?.length > 3 && (
              <span className="text-[10px] text-slate-400 self-center">
                +{movie.genres.length - 3}
              </span>
            )}
          </div>
        </div>

        {/* View Details Action */}
        <Link
          to={`/movies/${movie.id}`}
          className="w-full mt-2 inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-800 hover:bg-amber-500 text-slate-300 hover:text-slate-950 text-xs font-semibold rounded-xl border border-slate-700 hover:border-amber-400 transition-all cursor-pointer"
        >
          <Film className="w-3.5 h-3.5" />
          <span>View Details</span>
          <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
};

