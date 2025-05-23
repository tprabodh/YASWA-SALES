// src/pages/AdminDashboardPage.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboardPage() {
  const [reports, setReports] = useState([]);
  const navigate = useNavigate();

  // fetch reports & augment with officerName
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'reports'), async (snap) => {
      // 1) pull raw reports
      const raw = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // 2) collect all companyIds
      const uniqueIds = Array.from(
        new Set(raw.map(r => r.companyId).filter(Boolean))
      );

      // 3) fetch user names for each companyId
      const idToName = {};
      await Promise.all(uniqueIds.map(async companyId => {
        const q = query(
          collection(db, 'users'),
          where('companyId', '==', companyId)
        );
        const usersSnap = await getDocs(q);
        idToName[companyId] = usersSnap.empty
          ? 'Unknown'
          : usersSnap.docs[0].data().name;
      }));

      // 4) attach companyId & officerName
      const augmented = raw.map(r => ({
        ...r,
        officerName: idToName[r.companyId] || 'Unknown',
      }));

      setReports(augmented);
    });

    return () => unsub();
  }, []);

  const updateStatus = async (id, status) => {
    const ref = doc(db, 'reports', id);
    await updateDoc(ref, { status });
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6 overflow-x-auto">
      <div className="max-w-7xl mx-auto">
        <br />
        <br />
        <h2 className="text-2xl font-bold mb-6 text-black">
          Admin Dashboard
        </h2>
      <div class="inline-flex flex space-x-4 rounded-md shadow-xs" role="group">
        <button
          type='button'
          onClick={() => navigate('/employee-management')}
          className="px-3 py-1 bg-indigo-500 text-white mb-6 rounded hover:bg-indigo-900"
          >
          Go to Employee Management
        </button>
         
         <button type='button'  
         onClick={() => navigate('/admin/employee-summary')}
        className="px-3 py-1 bg-indigo-500 text-white mb-6 rounded hover:bg-indigo-900">
        Managers Summary
        </button>
        </div>
       

        <div className="overflow-x-auto bg-white shadow rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Student Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Officer ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Officer Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Course Purchased
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reports.map((r, i) => (
                <tr
                  key={r.id}
                  className={`${i % 2 === 0 ? 'bg-gray-100' : 'bg-white'} hover:bg-gray-200 transition`}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {r.studentName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {r.companyId}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {r.officerName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {r.course}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {r.status}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                    <button
                      onClick={() => updateStatus(r.id, 'Approved')}
                      className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => updateStatus(r.id, 'Rejected')}
                      className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                    >
                      Reject
                    </button>
                    <button
    onClick={() => navigate(`/view/${r.id}`, { state: { from: 'admin' } })}
    className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
  >
    View
  </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}



