// src/components/TopBar.jsx
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { useUserProfile } from '../hooks/useUserProfile';
import '../styles.css'; // Ensure this import is present

export default function TopBar() {
  const navigate = useNavigate();
  const { profile, loading } = useUserProfile();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  if (loading) return null;

  return (
    <nav className="topbar">
      <div className="topbar-left">
        <NavLink to="/">
          <img src="/logo.png" alt="Logo" className="logo" />
        </NavLink>
      </div>
      <div className="topbar-links">
        <NavLink to="/submit" className="nav-link">Submit</NavLink>
        <NavLink to="/reports" className="nav-link">My Reports</NavLink>
        {profile.role === 'manager' && <NavLink to="/manager" className="nav-link">Manager View</NavLink>}
        {profile.role === 'admin' && <NavLink to="/admin" className="nav-link">Admin Panel</NavLink>}
      </div>
      <button onClick={handleLogout} className="logout-btn">
        Logout
      </button>
    </nav>
  );
}
