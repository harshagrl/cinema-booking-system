import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthProvider';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';

import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { MovieListingPage } from './pages/MovieListingPage';
import { MovieDetailsPage } from './pages/MovieDetailsPage';
import { SeatSelectionPage } from './pages/SeatSelectionPage';
import { MyBookingsPage } from './pages/MyBookingsPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AdminMoviesPage } from './pages/AdminMoviesPage';
import { AdminTheatresPage } from './pages/AdminTheatresPage';
import { AdminShowsPage } from './pages/AdminShowsPage';
import { StaffTicketValidationPage } from './pages/StaffTicketValidationPage';
import { UnauthorizedPage } from './pages/UnauthorizedPage';

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
          <Navbar />
          <main className="flex-1">
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<HomePage />} />
              <Route path="/movies" element={<MovieListingPage />} />
              <Route path="/movies/:id" element={<MovieDetailsPage />} />
              <Route path="/shows/:showId/seats" element={<SeatSelectionPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/unauthorized" element={<UnauthorizedPage />} />

              {/* Customer Bookings & Reservations */}
              <Route
                path="/my-bookings"
                element={
                  <ProtectedRoute allowedRoles={['CUSTOMER', 'STAFF', 'ADMIN']}>
                    <MyBookingsPage />
                  </ProtectedRoute>
                }
              />

              {/* Role-Protected Admin Routes */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <AdminDashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/movies"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <AdminMoviesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/theatres"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <AdminTheatresPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/shows"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <AdminShowsPage />
                  </ProtectedRoute>
                }
              />

              {/* Staff & Admin Gate Scanner */}
              <Route
                path="/staff/ticket-validation"
                element={
                  <ProtectedRoute allowedRoles={['STAFF', 'ADMIN']}>
                    <StaffTicketValidationPage />
                  </ProtectedRoute>
                }
              />

              {/* Catch-all redirect */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
