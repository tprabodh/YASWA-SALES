// src/pages/ManagerViewPage.jsx
import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useUserProfile } from '../hooks/useUserProfile';
import { useNavigate } from 'react-router-dom';

export default function ManagerViewPage() {
  const { profile, loading } = useUserProfile();
  const [reports, setReports] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !profile) return;

    const fetchReports = async () => {
      try {
        const reportsRef = collection(db, 'reports');
        const q = query(
          reportsRef,
          where('managerId', '==', profile.companyId)
        );
        const snap = await getDocs(q);
        setReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error(err);
      }
    };
    fetchReports();
  }, [loading, profile]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          Reports Managed by You
        </h2>

        {reports.length === 0 ? (
          <p className="text-gray-600">No reports found.</p>
        ) : (
          <div className="overflow-x-auto bg-white rounded-lg shadow">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['Student', 'Course', 'Status', 'View'].map((hdr) => (
                    <th
                      key={hdr}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide"
                    >
                      {hdr}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reports.map((r, i) => (
                  <tr
                    key={r.id}
                    className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-gray-800">
                      {r.studentName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-800">
                      {r.course}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-800">
                      {r.status}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => navigate(`/view/${r.id}`, { state: { from: 'manager' } })}
                        className="px-3 py-1 bg-[#8a1ccf] text-white rounded hover:bg-[#7a1bbf] transition text-sm"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
