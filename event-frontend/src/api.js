import axios from "axios";

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL + "/api",
});

/** ========================
 * AUTH TOKEN ATTACHMENT
 * ======================== */
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** ========================
 * GLOBAL ERROR HANDLING
 * ======================== */
API.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

/** ========================
 * AUTH
 * ======================== */
export const register = (d) => API.post("/auth/register", d);
export const login    = (d) => API.post("/auth/login", d);
export const getMe    = ()  => API.get("/auth/me");

/** ========================
 * EVENTS
 * BUG FIX: getEvents now accepts and passes params as query string
 * Before: getEvents = () => API.get("/events")         ← params ignored!
 * After:  getEvents = (params) => API.get("/events", { params })
 * ======================== */
export const getEvents      = (params = {}) => API.get("/events", { params });
export const getEvent       = (id)          => API.get(`/events/${id}`);
export const getMyEvents    = ()            => API.get("/events/my");
export const createEvent    = (d)           => API.post("/events", d);
export const updateEvent    = (id, d)       => API.put(`/events/${id}`, d);
export const publishEvent   = (id)          => API.post(`/events/${id}/publish`);
export const deleteEvent    = (id)          => API.delete(`/events/${id}`);

export const uploadBanner = (id, file) => {
  const fd = new FormData();
  fd.append("banner", file);
  return API.post(`/events/${id}/banner`, fd);
};

export const getEventDashboard = (id) => API.get(`/events/${id}/dashboard`);

/** ========================
 * BOOKINGS
 * ======================== */
export const createBooking = (d)  => API.post("/bookings", d);
export const getMyBookings = ()   => API.get("/bookings/my");
export const cancelBooking = (id) => API.delete(`/bookings/${id}`);

/** ========================
 * PAYMENTS
 * ======================== */
export const simulatePayment = (id, success) =>
  API.post(`/payments/simulate/${id}`, { success });

/** ========================
 * TICKETS
 * ======================== */
export const getMyTickets  = ()   => API.get("/tickets/my");
export const getTicketQR   = (id) => API.get(`/tickets/${id}/qr`);
export const cancelTicket  = (id) => API.delete(`/tickets/${id}`);

/** ========================
 * ATTENDANCE
 * ======================== */
export const scanQR = (qrCode) =>
  API.post("/attendance/scan", { qrCode });

export const getEventAttendance = (id) =>
  API.get(`/attendance/event/${id}`);

export const getEventAttendanceSummary = (id) =>
  API.get(`/attendance/event/${id}/summary`);

export default API;