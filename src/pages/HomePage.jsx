// src/pages/HomePage.jsx
import React from 'react';
import { useUserProfile } from '../hooks/useUserProfile';
import { Link } from 'react-router-dom';
import { useEffect,useState,useRef } from 'react';

const blobSVG = (
  <svg viewBox="0 0 600 600" className="w-full h-full">
    <path
      fill="#8a1ccf10"
      d="M430.6,336.1Q391.1,422.3,308.1,456.9Q225.1,491.5,144.8,455.7Q64.6,419.8,67.0,339.9Q69.3,260.0,154.8,203.9Q240.2,147.7,319.5,160.6Q398.8,173.5,428.7,247.0Q458.7,320.4,430.6,336.1Z"
    />
  </svg>
);

export default function HomePage() {
 const { profile } = useUserProfile();
  const name = profile?.name ?? 'Team Member';
  const role = profile?.role;
  const sectionsRef = useRef([]);
  const [activeIdx, setActiveIdx] = useState(0);

   useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setActiveIdx(Number(e.target.dataset.idx));
          }
        });
      },
      { rootMargin: '-50% 0px -50% 0px', threshold: 0 }
    );
    sectionsRef.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);


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
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle,#8a1ccf20_1px,transparent_1px)] bg-[size:20px_20px]" />

      <div className="max-w-4xl mx-auto text-center space-y-32">
        <section
          ref={(el) => sectionsRef.current?.push(el)}
          data-idx={0}
          className="relative"
        >
          <h1 className="text-4xl font-extrabold text-[#8a1ccf] mb-4">Welcome, {name}!</h1>
          <p className="text-gray-600">Yaswa Academy portal is your hub for sales, commissions, docs, training and more.</p>
          <div className={`pointer-events-none absolute w-56 h-56 transform ${activeIdx === 0 ? 'left-0' : ''} ${activeIdx !== 0 ? 'right-0' : ''} -translate-y-1/4`}>
            {blobSVG}
          </div>
        </section>

        {buttons
          .filter((b) => b.roles.includes('*') || b.roles.includes(role))
          .map((btn, i) => (
            <section
              key={btn.to}
              ref={(el) => sectionsRef.current?.push(el)}
              data-idx={i + 1}
              className="relative"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <Link
                  to={btn.to}
                  className="group relative block h-full bg-white rounded-xl shadow-md border border-transparent p-6 transition duration-300 hover:shadow-xl hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-[#8a1ccf]"
                >
                  <div className="absolute left-0 top-0 h-0.5 w-0 bg-[#8a1ccf] group-hover:w-full transition-all duration-300" />
                  <h2 className="text-xl font-semibold text-[#8a1ccf] group-hover:text-[#6a13a0] mb-2">
                    {btn.label}
                  </h2>
                  <p className="text-gray-500 group-hover:text-gray-700">Go to {btn.label}</p>
                </Link>
              </div>
              <div
                className={`pointer-events-none absolute w-56 h-56 transform -translate-y-1/4 ${
                  activeIdx === i + 1
                    ? (i % 2 === 0 ? 'left-0' : 'right-0')
                    : 'opacity-0'
                } transition-opacity duration-500`}
              >
                {blobSVG}
              </div>
            </section>
          ))}
      </div>
    </div>
  );
}