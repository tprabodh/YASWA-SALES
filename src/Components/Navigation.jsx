// src/components/Navigation.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import useAuth from '../hooks/UseAuth';

const Navigation = () => {
  const { role } = useAuth();

  return (
    <nav>
      <Link to="/dashboard">Dashboard</Link>
      {role === 'admin' && <Link to="/admin">Admin Panel</Link>}
      {role === 'admin' && <Link to="/admin/employees">Manage Employees</Link>}

    </nav>
  );
};

export default Navigation;
