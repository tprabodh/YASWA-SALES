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
import SearchBar from '../Components/SearchBar';

export default function AdminDashboardPage() {
  const [reports, setReports]       = useState([]);
  const [queryText, setQueryText]   = useState('');
  const navigate                    = useNavigate();

  // fetch reports & augment with officerName
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'reports'), async (snap) => {
      const raw = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      const uniqueIds = Array.from(
        new Set(raw.map(r => r.companyId).filter(Boolean))
      );

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

      const augmented = raw.map(r => ({
        ...r,
        officerName:  idToName[r.companyId] || 'Unknown',
      }));

      setReports(augmented);
    });

    return () => unsub();
  }, []);

  const updateStatus = async (id, status) => {
    const ref = doc(db, 'reports', id);
    await updateDoc(ref, { status });
  };

  // filter by studentName, officer ID, or officerName
  const filtered = reports.filter(r =>
    r.studentName?.toLowerCase().includes(queryText.toLowerCase()) ||
    r.companyId?.toLowerCase().includes(queryText.toLowerCase()) ||
    r.officerName?.toLowerCase().includes(queryText.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-100 p-6 overflow-x-auto">
      <div className="max-w-7xl mx-auto">
        <br /><br />
        <h2 className="text-2xl font-bold mb-6 text-black">
          Admin Dashboard
        </h2>

        {/* Action buttons */}
        <div className="inline-flex space-x-4 mb-6" role="group">
          <button
            type='button'
            onClick={() => navigate('/employee-management')}
            className="px-3 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-900"
          >
            Employee Management
          </button>
          <button
            type='button'
            onClick={() => navigate('/admin/employee-summary')}
            className="px-3 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-900"
          >
            Team Leads Summary
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/businesshead-summary')}
            className="px-3 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-900"
          >
            Sales Managers Summary
          </button>
          
          <button
            type="button"
            onClick={() => navigate('/admin/payment-history')}
            className="px-3 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-900"
          >
            Payment History
          </button>
           <button
           type="button"
           onClick={() => navigate('/admin/upload-designs')}
           className="px-3 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-900"
         >
           Downloads Input
         </button>
          <button
           type="button"
           onClick={() => navigate('/admin/bulletin-input')}
           className="px-3 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-900"
         >
           Bulletin Input
         </button>
          
        </div>

        {/* Search bar */}
        <SearchBar
          query={queryText}
          setQuery={setQueryText}
          className="mb-4 max-w-sm"
        />

        {/* Reports table */}
        <div className="overflow-x-auto bg-white shadow rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                {[
                  'Student Name',
                  'Consultant ID',
                  'Officer Name',
                  'Course Purchased',
                  'Status',
                  'Actions'
                ].map(header => (
                  <th
                    key={header}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((r, i) => (
                <tr
                  key={r.id}
                  className={`${i % 2 === 0 ? 'bg-gray-100' : 'bg-white'} hover:bg-gray-200 transition`}
                >
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {r.studentName}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {r.companyId}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {r.officerName}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {r.course}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {r.status}
                  </td>
                  <td className="px-6 py-4 text-sm space-x-2">
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
                      className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    No reports match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
