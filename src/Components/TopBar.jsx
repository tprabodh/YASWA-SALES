// src/components/TopBar.jsx

import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { auth }                 from '../firebase';
import { signOut }              from 'firebase/auth';
import { useUserProfile }       from '../hooks/useUserProfile';
import logo                     from '../assests/logo.png';

export default function TopBar() {
  const navigate   = useNavigate();
  const { profile, loading } = useUserProfile();
  const [menuOpen, setMenuOpen]       = useState(false);
  const [loggingOut, setLoggingOut]   = useState(false);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await signOut(auth);
      // wait a moment for Firebase state to settle
      setTimeout(() => navigate('/'), 100);
    } catch (error) {
      console.error('Logout failed:', error);
      setLoggingOut(false);
    }
  };

  // while auth is loading or we're in the middle of logging out, render nothing
  if (loading || loggingOut) return null;

  // helper to conditionally close mobile menu on link click
  const closeMenu = () => setMenuOpen(false);

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
            {/* Employee / Associate / Manager-only links */}
            {['employee', 'associate', 'manager'].includes(profile.role) && (
              <>
                <NavLink
                  to="/submit"
                  className={({ isActive }) =>
                    `px-3 py-1 rounded ${
                      isActive ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-indigo-100'
                    }`
                  }
                >
                  Submit Sales Report
                </NavLink>

                <NavLink
                  to="/reports"
                  className={({ isActive }) =>
                    `px-3 py-1 rounded ${
                      isActive ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-indigo-100'
                    }`
                  }
                >
                  My Sales Reports Status
                </NavLink>
              </>
            )}

            {/* Everyone sees Profile, Downloads, Bulletin */}
            <NavLink
              to="/profile"
              className={({ isActive }) =>
                `px-3 py-1 rounded ${
                  isActive ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-indigo-100'
                }`
              }
            >
              Profile
            </NavLink>

            <NavLink
              to="/downloads"
              className={({ isActive }) =>
                `px-3 py-1 rounded ${
                  isActive ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-indigo-100'
                }`
              }
            >
              Downloads
            </NavLink>

            <NavLink
              to="/bulletins"
              className={({ isActive }) =>
                `px-3 py-1 rounded ${
                  isActive ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-indigo-100'
                }`
              }
            >
              Bulletin
            </NavLink>

            {/* Manager-only */}
            {profile.role === 'manager' && (
              <>
                <NavLink
                  to="/manager"
                  className={({ isActive }) =>
                    `px-3 py-1 rounded ${
                      isActive ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-indigo-100'
                    }`
                  }
                >
                  My Team Sales Report
                </NavLink>

                <NavLink
                  to="/manager-unpaid-commissions"
                  className={({ isActive }) =>
                    `px-3 py-1 rounded ${
                      isActive ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-indigo-100'
                    }`
                  }
                  onClick={closeMenu}
                >
                  My Payment History
                </NavLink>

                <NavLink
                  to="/manager-payment-history"
                  className={({ isActive }) =>
                    `px-3 py-1 rounded ${
                      isActive ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-indigo-100'
                    }`
                  }
                  onClick={closeMenu}
                >
                  My Team's Payment History
                </NavLink>
              </>
            )}

            {/* Admin-only */}
            {profile.role === 'admin' && (
              <>
                <NavLink
                  to="/admin"
                  className={({ isActive }) =>
                    `px-3 py-1 rounded ${
                      isActive ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-indigo-100'
                    }`
                  }
                >
                  Admin Panel
                </NavLink>

                <NavLink
                  to="/bulletins/upload-pdf-template"
                  className={({ isActive }) =>
                    `px-3 py-1 rounded ${
                      isActive ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-indigo-100'
                    }`
                  }
                >
                  Upload PDF Template
                </NavLink>
              </>
            )}

            {/* Telecaller-only */}
            {profile.role === 'telecaller' && (
              <>
                <NavLink
                  to="/telecaller"
                  className={({ isActive }) =>
                    `px-3 py-1 rounded ${
                      isActive ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-indigo-100'
                    }`
                  }
                  onClick={closeMenu}
                >
                  My Team Leads
                </NavLink>

                <NavLink
                  to="/forecast"
                  className={({ isActive }) =>
                    `px-3 py-1 rounded ${
                      isActive ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-indigo-100'
                    }`
                  }
                >
                  Monthly Summary
                </NavLink>

                <NavLink
                  to="/forecast-input"
                  className={({ isActive }) =>
                    `px-3 py-1 rounded ${
                      isActive ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-indigo-100'
                    }`
                  }
                >
                  Forecast Input
                </NavLink>
              </>
            )}

            {/* Business Head-only */}
            {profile.role === 'businessHead' && (
              <NavLink
                to="/businesshead"
                className={({ isActive }) =>
                  `px-3 py-1 rounded ${
                    isActive ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-indigo-100'
                  }`
                }
              >
                Senior Manager's Dashboard
              </NavLink>
            )}

            {/* Employee/Associate/BDC-only Payment History */}
            {['employee', 'associate', 'businessDevelopmentConsultant'].includes(profile.role) && (
              <NavLink
                to="/payment-history"
                className={({ isActive }) =>
                  `px-3 py-1 rounded ${
                    isActive ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-indigo-100'
                  }`
                }
                onClick={closeMenu}
              >
                Payment History
              </NavLink>
            )}

            {/* Sales Head-only */}
            {profile.role === 'salesHead' && (
              <NavLink
                to="/my-business-heads"
                className={({ isActive }) =>
                  `px-3 py-1 rounded ${
                    isActive ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-indigo-100'
                  }`
                }
              >
                Sales Head's Dashboard
              </NavLink>
            )}

            {/* BDC-only */}
            {profile.role === 'businessDevelopmentConsultant' && (
              <>
              <NavLink
                to="/bdc-report"
                className={({ isActive }) =>
                  `px-3 py-1 rounded ${
                    isActive ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-indigo-100'
                  }`
                }
              >
                Submit BDC Sales Report
              </NavLink>

              <NavLink
                  to="/reports"
                  className={({ isActive }) =>
                    `px-3 py-1 rounded ${
                      isActive ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-indigo-100'
                    }`
                  }
                >
                  My Sales Reports Status
                </NavLink>
                </>
            )}

            {/* Logout Button */}
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
              {menuOpen ? (
                // X icon
                <svg
                  className="h-6 w-6"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                // Hamburger icon
                <svg
                  className="h-6 w-6"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {/* Employee / Associate / Manager-only */}
            {['employee', 'associate', 'manager'].includes(profile.role) && (
              <>
                <NavLink
                  to="/submit"
                  onClick={closeMenu}
                  className="block text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-base font-medium"
                >
                  Submit Sales Report
                </NavLink>
                <NavLink
                  to="/reports"
                  onClick={closeMenu}
                  className="block text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-base font-medium"
                >
                  My Sales Reports Status
                </NavLink>
              </>
            )}

            {/* Everyone */}
            <NavLink
              to="/profile"
              onClick={closeMenu}
              className="block text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-base font-medium"
            >
              Profile
            </NavLink>
            <NavLink
              to="/downloads"
              onClick={closeMenu}
              className="block text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-base font-medium"
            >
              Downloads
            </NavLink>
            <NavLink
              to="/bulletins"
              onClick={closeMenu}
              className="block text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-base font-medium"
            >
              Bulletin
            </NavLink>

            {/* Manager-only */}
            {profile.role === 'manager' && (
              <>
                <NavLink
                  to="/manager"
                  onClick={closeMenu}
                  className="block text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-base font-medium"
                >
                  My Team Sales Report
                </NavLink>
                <NavLink
                  to="/manager-unpaid-commissions"
                  onClick={closeMenu}
                  className="block text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-base font-medium"
                >
                  My Payment History
                </NavLink>
                <NavLink
                  to="/manager-payment-history"
                  onClick={closeMenu}
                  className="block text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-base font-medium"
                >
                  Payment History
                </NavLink>
              </>
            )}

            {/* Admin-only */}
            {profile.role === 'admin' && (
              <>
                <NavLink
                  to="/admin"
                  onClick={closeMenu}
                  className="block text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-base font-medium"
                >
                  Admin Panel
                </NavLink>
                <NavLink
                  to="/bulletins/upload-pdf-template"
                  onClick={closeMenu}
                  className="block text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-base font-medium"
                >
                  Upload PDF Template
                </NavLink>
              </>
            )}

            {/* Telecaller-only */}
            {profile.role === 'telecaller' && (
              <>
                <NavLink
                  to="/telecaller"
                  onClick={closeMenu}
                  className="block text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-base font-medium"
                >
                  Telecaller View
                </NavLink>
                <NavLink
                  to="/forecast"
                  onClick={closeMenu}
                  className="block text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-base font-medium"
                >
                  MONTHLY SUMMARY
                </NavLink>
                <NavLink
                  to="/forecast-input"
                  onClick={closeMenu}
                  className="block text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-base font-medium"
                >
                  Forecast Input
                </NavLink>
              </>
            )}

            {/* Business Head-only */}
            {profile.role === 'businessHead' && (
              <NavLink
                to="/businesshead"
                onClick={closeMenu}
                className="block text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-base font-medium"
              >
                Senior Manager's View
              </NavLink>
            )}

            {/* Employee/Associate/BDC-only Payment History */}
            {['employee', 'associate', 'businessDevelopmentConsultant'].includes(profile.role) && (
              <NavLink
                to="/payment-history"
                onClick={closeMenu}
                className="block text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-base font-medium"
              >
                Payment History
              </NavLink>
            )}

            {/* Sales Head-only */}
            {profile.role === 'salesHead' && (
              <NavLink
                to="/my-business-heads"
                onClick={closeMenu}
                className="block text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-base font-medium"
              >
                My Business Heads
              </NavLink>
            )}

            {/* BDC-only */}
            {profile.role === 'businessDevelopmentConsultant' && (
              <NavLink
                to="/bdc-report"
                onClick={closeMenu}
                className="block text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-base font-medium"
              >
                Submit BDC Sales Report
              </NavLink>
            )}

            {/* Logout */}
            <button
              onClick={() => {
                closeMenu();
                handleLogout();
              }}
              className="w-full text-left bg-red-500 text-white px-3 py-2 rounded-md text-base font-medium hover:bg-red-600"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
