import axios from 'axios';

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL
    ? `${process.env.REACT_APP_API_URL}/api`
    : 'http://localhost:3000/api',
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

API.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Auth
export const register = (data) => API.post('/auth/register', data);
export const login = (data) => API.post('/auth/login', data);
export const getMe = () => API.get('/auth/me');

// Events
export const getEvents = (params) => API.get('/events', { params });
export const getEvent = (id) => API.get(`/events/${id}`);
export const getMyEvents = () => API.get('/events/my');
export const createEvent = (data) => API.post('/events', data);
export const updateEvent = (id, data) => API.put(`/events/${id}`, data);
export const publishEvent = (id) => API.post(`/events/${id}/publish`);
export const deleteEvent = (id) => API.delete(`/events/${id}`);
export const uploadBanner = (id, file) => {
  const fd = new FormData();
  fd.append('banner', file);
  return API.post(`/events/${id}/banner`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
export const getEventDashboard = (id) => API.get(`/events/${id}/dashboard`);

// Bookings
export const createBooking = (data) => API.post('/bookings', data);
export const getMyBookings = () => API.get('/bookings/my');
export const getBooking = (id) => API.get(`/bookings/${id}`);
export const cancelBooking = (id) => API.delete(`/bookings/${id}`);
export const getEventBookings = (eventId) => API.get(`/bookings/event/${eventId}`);

// Payments
export const simulatePayment = (bookingId, success) =>
  API.post(`/payments/simulate/${bookingId}`, { success });

// Tickets
export const getMyTickets = () => API.get('/tickets/my');
export const getTicket = (id) => API.get(`/tickets/${id}`);
export const getTicketQR = (id) => API.get(`/tickets/${id}/qr`);
export const cancelTicket = (id) => API.delete(`/tickets/${id}`);

// Attendance
export const scanQR = (qrCode) => API.post('/attendance/scan', { qrCode });
export const getEventAttendance = (eventId) => API.get(`/attendance/event/${eventId}`);
export const getEventAttendanceSummary = (eventId) =>
  API.get(`/attendance/event/${eventId}/summary`);
export const getUserAttendanceHistory = (userId) =>
  API.get(`/attendance/user/${userId}`);
