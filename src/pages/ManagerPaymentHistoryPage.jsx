// src/pages/ManagerPaymentHistoryPage.jsx
import React, { useEffect, useState } from 'react';
import { useUserProfile }        from '../hooks/useUserProfile';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';

export default function ManagerPaymentHistoryPage() {
  const { profile, loading: authLoading } = useUserProfile();
  const navigate = useNavigate();

  const companyId = profile?.companyId;
  const [runs,    setRuns]    = useState([]); // raw paymentHistory docs
  const [counts,  setCounts]  = useState({}); // { runId: numberOfPaid }
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (
      authLoading ||
      profile?.role !== 'manager' ||
      !companyId
    ) return;

    (async () => {
      // 1) load my payment runs
      const runsQ = query(
        collection(db, 'paymentHistory'),
        where('employeeId', '==', companyId)
      );
      const snap = await getDocs(runsQ);
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setRuns(docs);

      // 2) count paid reports per run
      const cts = {};
      await Promise.all(
        docs.map(async run => {
          const { start, end } = run.dateRange;
          const rptQ = query(
            collection(db, 'reports'),
            where('managerId',        '==', companyId),
            where('createdAt',       '>=', start),
            where('createdAt',       '<=', end),
            where('paymentStatus',   '==','paid'),
            where('managerCommission','==','paid')
          );
          const rptSnap = await getDocs(rptQ);
          cts[run.id] = rptSnap.size;
        })
      );
      setCounts(cts);
      setLoading(false);
    })();
  }, [authLoading, companyId, profile?.role]);

  // loading / auth guards
  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Loading payment history…</p>
      </div>
    );
  }
  if (profile?.role !== 'manager' || !companyId) {
    return <Navigate to="/" replace />;
  }
  if (!runs.length) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold">Manager Payment History</h2>
        <p className="mt-4 text-gray-500">No payment runs found.</p>
      </div>
    );
  }

  // helper to look up UID from companyId
  const lookupUid = async (companyId) => {
    const uSnap = await getDocs(
      query(collection(db,'users'), where('companyId','==',companyId))
    );
    return uSnap.empty ? null : uSnap.docs[0].id;
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Manager Payment History</h2>
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              {[
                'Date Range',
                'Paid At',
                'Subordinate IDs',
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
            {runs.map((run, idx) => {
              const s = run.dateRange.start.toDate();
              const e = run.dateRange.end.toDate();
              const paidCount = counts[run.id] || 0;
              const subs       = run.subordinateIds || [];

              return (
                <tr
                  key={run.id}
                  className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                >
                  <td className="px-6 py-3 text-sm text-gray-800">
                    {s.toLocaleDateString()} – {e.toLocaleDateString()}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-800">
                    {run.paidAt.toDate().toLocaleString()}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-800">
                    {subs.join(', ')}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-800">
                    {paidCount}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-800">
                    ₹{paidCount * 500}
                  </td>
                  <td className="px-6 py-3 text-sm">
                    <button
                      className="px-3 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600 text-sm"
                      onClick={async () => {
                        // translate my companyId → my uid
                        const myUid = await lookupUid(companyId);
                        if (!myUid) {
                          alert('Could not find your user record.');
                          return;
                        }
                        navigate(
                          '/manager/paid-reports',
                          { state: { range: { start: s, end: e } } }
                        );
                      }}
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
