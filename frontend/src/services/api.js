import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // Send HTTP-only session cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for consistent error extraction
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const errorData = error.response?.data || {};
    const message = errorData.message || error.message || 'An unexpected error occurred';
    const code = errorData.code || 'UNKNOWN_ERROR';
    const errors = errorData.errors || null;

    return Promise.reject({
      message,
      code,
      errors,
      status: error.response?.status || 500,
    });
  }
);

export default api;

