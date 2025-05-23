// src/pages/PaymentHistoryPage.jsx
import React, { useEffect, useState } from 'react';
import { useUserProfile } from '../hooks/useUserProfile';
import { Navigate, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export default function PaymentHistoryPage() {
  const { profile, loading: authLoading } = useUserProfile();
  const navigate = useNavigate();

  // extract companyId safely
  const companyId = profile?.companyId;

  const [histories, setHistories] = useState([]); // raw history docs
  const [counts,    setCounts]    = useState({}); // { historyId: count }
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    // only run once we know who we are
    if (authLoading || !companyId || !['employee','manager'].includes(profile.role)) {
      return;
    }
    (async () => {
      // 1) load all paymentHistory entries where subordinateIds includes me
      const histQ = query(
        collection(db, 'paymentHistory'),
        where('subordinateIds', 'array-contains', companyId)
      );
      const histSnap = await getDocs(histQ);
      const docs = histSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setHistories(docs);

      // 2) for each history run, count *my* fully-paid reports
      const cts = {};
      await Promise.all(docs.map(async entry => {
        const { start, end } = entry.dateRange;
        const rptQ = query(
          collection(db, 'reports'),
          where('companyId', '==', companyId),
          where('createdAt', '>=', start),
          where('createdAt', '<=', end),
          where('paymentStatus', '==', 'paid'),
          where('managerCommission', '==', 'paid')     // ← your new filter
        );
        const rptSnap = await getDocs(rptQ);
        cts[entry.id] = rptSnap.size;
      }));
      setCounts(cts);
      setLoading(false);
    })();
  }, [authLoading, companyId, profile?.role]);

  // 1) still loading auth/profile or our fetch
  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Loading…</p>
      </div>
    );
  }

  // 2) not logged in or no companyId → back to login
  if (!companyId) {
    return <Navigate to="/" replace />;
  }

  // 3) only employees/managers get here
  if (!['employee','manager'].includes(profile.role)) {
    return <Navigate to="/" replace />;
  }

  // 4) nothing found
  if (!histories.length) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold">Payment History</h2>
        <p className="mt-4 text-gray-500">No payment runs found for you.</p>
      </div>
    );
  }

  // render your table, including # Paid Reports, My Commission, etc.
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Payment History</h2>
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              {[
                'Date Range',
                'Paid At',
                'Manager ID',
                'Your ID',
                '# Paid Reports',
                'My Commission',
                'Actions'
              ].map(h => (
                <th
                  key={h}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {histories.map((h, i) => {
              const s = h.dateRange.start.toDate();
              const e = h.dateRange.end.toDate();
              const paidCount = counts[h.id] || 0;
              return (
                <tr key={h.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-6 py-3 text-sm text-gray-800">
                    {s.toLocaleDateString()} – {e.toLocaleDateString()}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-800">
                    {h.paidAt.toDate().toLocaleString()}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-800">
                    {h.employeeId /* manager’s companyId */}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-800">
                    {companyId}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-800">
                    {paidCount}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-800">
                    ₹{paidCount * 2000}
                  </td>
                  <td className="px-6 py-3 text-sm">
                    <button
                      className="px-3 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600"
                      onClick={() =>
                        navigate(
                          `/summary/${profile.uid}`,
                          { state: { range: { start: s, end: e } } }
                        )
                      }
                    >
                      View Reports
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
