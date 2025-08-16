import axios from 'axios';

const API = axios.create({
  baseURL: 'http://127.0.0.1:8000/api/',
});


API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access');
   if (token) {
  config.headers.Authorization = `Bearer ${token}`;
}

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor: Auto-refresh token if access token expired
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 and we haven't already tried refreshing
    if (
      error.response &&
      error.response.status === 401 &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('refresh');
      if (refreshToken) {
        try {
          // Try refreshing token
          const response = await axios.post(
            'http://127.0.0.1:8000/api/users/token/refresh/',
            { refresh: refreshToken }
          );
          const newAccessToken = response.data.access;

          // Save new token
          localStorage.setItem('access', newAccessToken);

          // Retry original request with new token
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return axios(originalRequest);
        } catch (refreshError) {
          // Refresh failed: clear storage and redirect to login
          localStorage.removeItem('access');
          localStorage.removeItem('refresh');
          window.location.href = '/';
        }
      } else {
        // No refresh token available
        localStorage.clear();
        window.location.href = '/';
      }
    }

    return Promise.reject(error);
  }
);

export default API;