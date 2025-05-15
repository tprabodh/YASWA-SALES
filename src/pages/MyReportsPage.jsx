// src/pages/MyReportsPage.jsx
import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import useAuth from '../hooks/UseAuth';
import { useNavigate } from 'react-router-dom';

export default function MyReportsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);

  useEffect(() => {
    if (loading || !user) return;

    const q = query(
      collection(db, 'reports'),
      where('userId', '==', user.uid)
    );

    const unsub = onSnapshot(q, async (snap) => {
      const reportsData = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const uniqueCompanyIds = [
        ...new Set(reportsData.map((report) => report.companyId).filter(Boolean)),
      ];

      const companyIdToEmployeeName = {};
      await Promise.all(
        uniqueCompanyIds.map(async (companyId) => {
          const usersQuery = query(
            collection(db, 'users'),
            where('companyId', '==', companyId)
          );
          const usersSnap = await getDocs(usersQuery);
          if (!usersSnap.empty) {
            const userDoc = usersSnap.docs[0];
            const userData = userDoc.data();
            companyIdToEmployeeName[companyId] = userData.name || 'N/A';
          } else {
            companyIdToEmployeeName[companyId] = 'N/A';
          }
        })
      );

      const augmentedReports = reportsData.map((report) => ({
        ...report,
        employeeName: companyIdToEmployeeName[report.companyId] || 'N/A',
      }));

      setReports(augmentedReports);
    });

    return () => unsub();
  }, [user, loading]);

  if (loading) {
    return <div>Loading...</div>;
  }
  
  

  const handleDelete = async id => {
    if (!window.confirm('Delete this report?')) return;
    await deleteDoc(doc(db, 'reports', id));
  };

  return (
    <div className="min-h-screen bg-white-900 text-black p-6">
      <h2 className="text-2xl font-bold mb-6 text-black">My Reports</h2>
  
      <div className="overflow-x-auto">
      <table className="min-w-full table-auto">
      <thead className="bg-gray-100">
  <tr>
    <th className="px-6 py-3 text-left text-sm font-semibold text-black-900">Student Name</th>
    <th className="px-6 py-3 text-left text-sm font-semibold text-black-900">Course Purchased</th>
    <th className="px-6 py-3 text-left text-sm font-semibold text-black-900">Status</th>
    <th className="px-6 py-3 text-left text-sm font-semibold text-black-900">Employee Name</th>
    <th className="px-6 py-3 text-left text-sm font-semibold text-black-900">Company ID</th>
    <th className="px-6 py-3 text-left text-sm font-semibold text-black-900">Actions</th>
  </tr>
</thead>
<tbody>
  {reports.map((r, index) => (
    <tr
      key={r.id}
      className={`${
        index % 2 === 0 ? 'bg-gray-50' : 'bg-white'
      } hover:bg-gray-100`}
    >
      <td className="px-6 py-4 whitespace-nowrap text-semibold text-black-900">{r.studentName}</td>
      <td className="px-6 py-4 whitespace-nowrap text-semibold text-black-900">{r.course}</td>
      <td className="px-6 py-4 whitespace-nowrap text-semibold text-black-900">{r.status}</td>
      <td className="px-6 py-4 whitespace-nowrap text-semibold text-black-900">{r.employeeName}</td>
      <td className="px-6 py-4 whitespace-nowrap text-semibold text-black-900">{r.companyId}</td>
      <td className="px-6 py-4 whitespace-nowrap space-x-2">
      <button
      className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-3 py-1 rounded transition"
      onClick={() => navigate(`/view/${r.id}`, { state: { from: 'reports' } })}
    >
      View
    </button>
        <button
          className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs px-3 py-1 rounded"
          onClick={() => navigate(`/submit/${r.id}`)}
        >
          Edit
        </button>
        <button
          className="bg-red-500 hover:bg-red-600 text-white text-xs px-3 py-1 rounded"
          onClick={() => handleDelete(r.id)}
        >
          Delete
        </button>
      </td>
    </tr>
  ))}
</tbody>

        </table>
      </div>
    </div>
  );
  
  
}
