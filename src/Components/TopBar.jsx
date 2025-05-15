import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { useUserProfile } from '../hooks/useUserProfile';
import logo from '../assests/logo.png';

export default function TopBar() {
  const navigate = useNavigate();
  const { profile, loading } = useUserProfile();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setLoggingOut(true); // Stop rendering based on profile
      await signOut(auth);
      setTimeout(() => {
        navigate('/');
      }, 100); // Allow Firebase to update auth state before navigating
    } catch (error) {
      console.error('Logout failed:', error);
      setLoggingOut(false); // Allow retry
    }
  };

  if (loading || loggingOut) return null;

  return (
    <nav className="bg-white shadow-md fixed top-0 left-0 right-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center">
            <img
              src={logo}
              alt="Logo"
              width={250}
              height={250}
              className="h-8 w-auto object-contain"
            />
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex md:items-center md:space-x-4">
            <NavLink to="/submit" className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium">
              Submit
            </NavLink>
            <NavLink to="/reports" className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium">
              My Reports
            </NavLink>
            {profile.role === 'manager' && (
              <NavLink to="/manager" className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium">
                Manager View
              </NavLink>
            )}
            {profile.role === 'admin' && (
              <NavLink to="/admin" className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium">
                Admin Panel
              </NavLink>
            )}
            <button
              onClick={handleLogout}
              className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Logout
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center md:hidden">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:text-white hover:bg-gray-700 focus:outline-none"
              aria-expanded={menuOpen}
            >
              <svg
                className="h-6 w-6"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <NavLink to="/submit" className="block text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-base font-medium" onClick={() => setMenuOpen(false)}>
              Submit
            </NavLink>
            <NavLink to="/reports" className="block text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-base font-medium" onClick={() => setMenuOpen(false)}>
              My Reports
            </NavLink>
            {profile.role === 'manager' && (
              <NavLink to="/manager" className="block text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-base font-medium" onClick={() => setMenuOpen(false)}>
                Manager View
              </NavLink>
            )}
            {profile.role === 'admin' && (
              <NavLink to="/admin" className="block text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-base font-medium" onClick={() => setMenuOpen(false)}>
                Admin Panel
              </NavLink>
            )}
            <button
              onClick={() => {
                setMenuOpen(false);
                handleLogout();
              }}
              className="w-full text-left bg-blue-600 text-white px-3 py-2 rounded-md text-base font-medium hover:bg-blue-700"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
