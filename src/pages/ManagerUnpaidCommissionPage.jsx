// src/pages/ManagerUnpaidCommissionPage.jsx

import React, { useEffect, useState } from 'react';
import { Navigate }    from 'react-router-dom';
import { useUserProfile } from '../hooks/useUserProfile';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { db }         from '../firebase';

export default function ManagerUnpaidCommissionPage() {
  const { profile, loading: authLoading } = useUserProfile();
  const companyId = profile?.companyId;
  const userId    = profile?.uid;       // manager’s own Firebase UID
  const [rows, setRows]     = useState([]); // accumulated “unpaid” report rows
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (profile?.role !== 'manager' || !companyId || !userId) return;

    (async () => {
      // 1) Find all paymentHistory docs where this manager’s companyId is in managerIds
      const runsQ = query(
        collection(db, 'paymentHistory'),
        where('managerIds', 'array-contains', companyId)
      );
      const runsSnap = await getDocs(runsQ);
      const runs = runsSnap.docs.map(d => d.data());

      // 2) For each “run”, query that date‐range for this manager’s own reports:
      //    paymentStatus == "paid"  AND  managerCommission != "paid"
      const unpaidAccumulator = [];
      const seenIds = new Set(); // track to avoid duplicates

      for (let run of runs) {
        const rawStart = run.dateRange?.start;
        const rawEnd   = run.dateRange?.end;
        if (!rawStart || !rawEnd) continue;

        // Convert to proper Timestamp objects if needed:
        const startTS = rawStart instanceof Timestamp
          ? rawStart
          : Timestamp.fromDate(rawStart.toDate?.() || new Date(rawStart));
        const endTS = rawEnd instanceof Timestamp
          ? rawEnd
          : Timestamp.fromDate(rawEnd.toDate?.() || new Date(rawEnd));

        // 2.a) Query manager’s own reports in that window:
        const rptQ = query(
          collection(db, 'reports'),
          where('userId', '==', userId),
          where('createdAt', '>=', startTS),
          where('createdAt', '<=', endTS),
          where('paymentStatus', '==', 'paid')
        );
        const rptSnap = await getDocs(rptQ);

        // 2.b) Filter client‐side: only keep ones whose managerCommission !== "paid"
        rptSnap.docs.forEach(docSnap => {
          const data = docSnap.data();
          if (data.managerCommission !== 'paid') {
            const id = docSnap.id;
            if (!seenIds.has(id)) {
              seenIds.add(id);
              unpaidAccumulator.push({
                id,
                studentName: data.studentName || '—',
                studentPhone: data.studentPhone || '—',
                createdAt: data.createdAt.toDate?.().toLocaleString() || '',
              });
            }
          }
        });
      }

      setRows(unpaidAccumulator);
      setLoading(false);
    })();
  }, [authLoading, profile, companyId, userId]);

  // 3) Loading / auth guards
  if (authLoading || loading) {
    return <p className="p-6">Loading unpaid commissions…</p>;
  }
  if (profile?.role !== 'manager') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="p-6">
        <br /><br />
      <h2 className="text-2xl font-extrabold text-[#8a1ccf] mb-4">
         {profile.name} ({profile.companyId})'s Payment History
      </h2>

      {rows.length === 0 ? (
        <p className="text-gray-500">All commissions have been processed.</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                {['S.No','Student Name','Student Phone','Incentive (₹)','Created At'].map(h => (
                  <th
                    key={h}
                    className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rows.map((r, idx) => (
                <tr key={r.id} className={idx % 2 ? 'bg-gray-50' : ''}>
                  <td className="px-4 py-2">{idx + 1}</td>
                  <td className="px-4 py-2">{r.studentName}</td>
                  <td className="px-4 py-2">{r.studentPhone}</td>
                  <td className="px-4 py-2">₹2,000</td>
                  <td className="px-4 py-2">{r.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
