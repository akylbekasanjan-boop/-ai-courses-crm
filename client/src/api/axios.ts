import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for handling token refresh
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const originalRequest = error.config;
    
    // Only try refresh once to avoid infinite loop
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      return axios.post('/api/auth/refresh', {}, { withCredentials: true })
        .then(() => api(originalRequest))
        .catch(() => {
          // Refresh failed - don't redirect immediately, let the component handle it
          return Promise.reject(error);
        });
    }
    
    return Promise.reject(error);
  }
);

export default api;