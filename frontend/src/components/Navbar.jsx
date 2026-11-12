import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { LogOut, User, Shield, Clapperboard, Film } from 'lucide-react';

export const Navbar = () => {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-900/60 text-purple-300 border-purple-700/50';
      case 'STAFF':
        return 'bg-blue-900/60 text-blue-300 border-blue-700/50';
      default:
        return 'bg-amber-900/60 text-amber-300 border-amber-700/50';
    }
  };

  return (
    <header className="bg-slate-900/90 backdrop-blur border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform">
            <Clapperboard className="w-5 h-5 text-slate-950" />
          </div>
          <div>
            <span className="text-xl font-bold bg-gradient-to-r from-slate-100 via-amber-200 to-amber-500 bg-clip-text text-transparent">
              Algions Cineplex
            </span>
            <span className="hidden sm:inline-block text-[10px] tracking-widest text-slate-400 uppercase block font-medium">
              Cinema Booking
            </span>
          </div>
        </Link>

        {/* Right Navigation */}
        <nav className="flex items-center gap-2 sm:gap-4">
          <Link
            to="/movies"
            className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-300 hover:text-amber-400 transition-colors px-2 py-1"
          >
            <Film className="w-4 h-4 text-amber-500" />
            <span>Movies</span>
          </Link>

          {isAuthenticated ? (
            <>
              {isAdmin && (
                <div className="flex items-center gap-1.5">
                  <Link
                    to="/admin/movies"
                    className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all"
                  >
                    <Film className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Manage Movies</span>
                  </Link>

                  <Link
                    to="/admin"
                    className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-purple-950/80 text-purple-300 border border-purple-800/60 hover:bg-purple-900/90 transition-all"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Admin Panel</span>
                  </Link>
                </div>
              )}

              {/* User Pill */}
              <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/60 px-2.5 py-1.5 rounded-lg">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-medium text-slate-200 max-w-[100px] sm:max-w-[120px] truncate">
                  {user.name}
                </span>
                <span
                  className={`text-[9px] sm:text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border ${getRoleBadge(
                    user.role
                  )}`}
                >
                  {user.role}
                </span>
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-red-400 hover:bg-red-950/30 px-2.5 py-1.5 rounded-lg border border-transparent hover:border-red-900/40 transition-all cursor-pointer"
                title="Log out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="text-xs sm:text-sm font-medium text-slate-300 hover:text-amber-400 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                Log In
              </Link>
              <Link
                to="/register"
                className="text-xs sm:text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-1.5 rounded-lg shadow-sm hover:shadow-amber-500/20 transition-all"
              >
                Register
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
};
