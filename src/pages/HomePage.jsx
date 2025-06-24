// src/pages/HomePage.jsx
import React from 'react';
import { useUserProfile } from '../hooks/useUserProfile';
import { Link } from 'react-router-dom';

export default function HomePage() {
  const { profile } = useUserProfile();
  const role = profile?.role;
  const name = profile?.name || 'Team Member';

   const buttons = [
    { to: '/submit', label: 'Submit Sales Report', roles: ['employee','associate','manager'] },
    { to: '/bdc-report', label: 'Submit BDC Sales Report', roles: ['businessDevelopmentConsultant'] },
    { to: '/reports', label: 'My Sales Reports Status', roles: ['employee','associate','manager','businessDevelopmentConsultant'] },
    { to: '/payment-history', label: 'Payment History', roles: ['employee','associate','businessDevelopmentConsultant'] },
    { to: '/profile', label: 'My Profile', roles: ['*'] },
    { to: '/downloads', label: 'Personal Documents', roles: ['*'] },
    { to: '/bulletins', label: 'Training Module', roles: ['*'] },
    { to: '/admin', label: 'Admin Panel', roles: ['admin'] },
    { to: '/admin/employee-summary', label: 'Employee Summary', roles: ['admin'] },
    { to: "/bulletins/upload-pdf-template", label: 'Upload Documents', roles: ['admin'] },
    { to: '/employee-management', label: 'Employee Management', roles: ['admin'] },
    { to: '/admin/bulletin-input', label: 'Training Module Input', roles: ['admin'] },
    { to: '/admin/payment-history', label: ' Payment History', roles: ['admin'] },
    { to: '/telecaller', label: 'Telecaller Dashboard', roles: ['telecaller'] },
    { to: '/forecast', label: 'Monthly Summary', roles: ['telecaller'] },
    { to: '/forecast-input', label: 'Forecast Input', roles: ['telecaller'] },
    { to: '/manager', label: "My Team's Sales Reports", roles: ['manager'] },
    { to: '/manager-unpaid-commissions', label: "My Payment History", roles: ['manager'] },
    { to: '/manager-payment-history', label: "My Team's Payment History", roles: ['manager'] },
    { to: '/businesshead', label: "Senior Manager's View", roles: ['businessHead'] },
    { to: '/my-business-heads', label: "Sales Head's View", roles: ['salesHead'] },
  ];


 return (
    <div className="relative min-h-screen bg-gradient-to-br from-purple-50 to-white py-20 px-4 overflow-hidden">
      {/* Enhanced dot-grid background */}
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle,#8a1ccf20_1px,transparent_1px)] bg-[length:20px_20px]" />

      

      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-4xl font-extrabold text-[#8a1ccf] mb-4">
          Welcome, {name}!
        </h1>
        <p className="text-gray-600 mb-12 text-2xl">
          Welcome to Yaswa sales Portal
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {buttons
            .filter(btn => btn.roles.includes('*') || btn.roles.includes(role))
            .map(btn => (
              <Link
                key={btn.to}
                to={btn.to}
                className="group relative block h-full bg-white rounded-xl shadow-md border border-transparent p-6 overflow-hidden transition duration-300 hover:shadow-xl hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-[#8a1ccf]"
              >
                <div className="absolute left-0 top-0 h-0.5 w-0 bg-[#8a1ccf] group-hover:w-full transition-all duration-300" />
                <h2 className="text-xl font-semibold text-[#8a1ccf] group-hover:text-[#6a13a0] mb-2">
                  {btn.label}
                </h2>
                <p className="text-gray-500 group-hover:text-gray-700">
                  Go to {btn.label}
                </p>
              </Link>
            ))}
        </div>
      </div>
    </div>
  );
}

