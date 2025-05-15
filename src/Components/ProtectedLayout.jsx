// src/components/ProtectedLayout.jsx
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import useAuth from '../hooks/UseAuth';
import TopBar from './TopBar';

export default function ProtectedLayout() {
  const user = useAuth();

  if (user === null) {
    // still loading
    return <div>Loading…</div>;
  }
  if (!user) {
    // not logged in
    return <Navigate to="/" />;
  }

  return (
    <div>
      <TopBar />
      {/* This is where child routes (like /submit, /reports, etc.) will render */}
      <Outlet />
    </div>
  );
}
