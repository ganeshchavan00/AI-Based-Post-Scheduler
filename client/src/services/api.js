import axios from 'axios';

// Resolve and normalize the backend API base URL
// Supports both VITE_API_URL and VITE_API_BASE_URL
const rawBaseUrl =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:5000/api';

const cleanBaseUrl = rawBaseUrl.trim().replace(/\/+$/, '');
const normalizedBaseUrl = cleanBaseUrl.endsWith('/api')
  ? cleanBaseUrl
  : `${cleanBaseUrl}/api`;

const api = axios.create({
  baseURL: normalizedBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

/**
 * Get backend host origin (stripping '/api')
 */
export const getBackendHost = () => {
  const currentBase = api.defaults.baseURL || normalizedBaseUrl;
  return currentBase.replace(/\/api\/?$/, '');
};

/**
 * Resolve full media URL for static uploads or external CDN links
 * @param {string} url - Relative (/uploads/...) or absolute (https://...) URL
 * @returns {string} Fully qualified media URL
 */
export const getMediaUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const host = getBackendHost();
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${host}${cleanPath}`;
};

// Interceptor to attach JWT token if present in localStorage
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for unified error extraction
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const customError = {
      message:
        error.response?.data?.message ||
        error.message ||
        'An unexpected network or server error occurred.',
      status: error.response?.status,
      errors: error.response?.data?.errors,
    };
    return Promise.reject(customError);
  }
);

export default api;
