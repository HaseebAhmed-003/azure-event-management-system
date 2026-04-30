import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import { NotFound } from './components/NotFound';

import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Events from './pages/Events';
import EventDetail from './pages/EventDetail';
import MyBookings from './pages/MyBookings';
import MyTickets from './pages/MyTickets';
import OrganizerEvents from './pages/OrganizerEvents';
import EventForm from './pages/EventForm';
import OrganizerDashboard from './pages/OrganizerDashboard';
import QRScanner from './pages/QRScanner';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/events" element={<Events />} />
          <Route path="/events/:id" element={<EventDetail />} />
          <Route path="/my-bookings" element={
            <ProtectedRoute role="ATTENDEE"><MyBookings /></ProtectedRoute>
          } />
          <Route path="/my-tickets" element={
            <ProtectedRoute role="ATTENDEE"><MyTickets /></ProtectedRoute>
          } />
          <Route path="/organizer/events" element={
            <ProtectedRoute role="ORGANIZER"><OrganizerEvents /></ProtectedRoute>
          } />
          <Route path="/organizer/events/new" element={
            <ProtectedRoute role="ORGANIZER"><EventForm /></ProtectedRoute>
          } />
          <Route path="/organizer/events/:id/edit" element={
            <ProtectedRoute role="ORGANIZER"><EventForm /></ProtectedRoute>
          } />
          <Route path="/organizer/events/:id/dashboard" element={
            <ProtectedRoute role="ORGANIZER"><OrganizerDashboard /></ProtectedRoute>
          } />
          <Route path="/organizer/scanner" element={
            <ProtectedRoute role="ORGANIZER"><QRScanner /></ProtectedRoute>
          } />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
