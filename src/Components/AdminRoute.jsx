// src/components/AdminRoute.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import useAuth from '../hooks/UseAuth';

const AdminRoute = ({ children }) => {
  const { role } = useAuth();

  if (role === 'admin') {
    return children;
  } else {
    return <Navigate to="/unauthorized" />;
  }
};

export default AdminRoute;
