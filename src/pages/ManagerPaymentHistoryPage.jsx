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

  // The manager's own companyId
  const managerCompanyId = profile?.companyId;

  // 1) Store payment-history runs
  const [runs,    setRuns]    = useState([]);    // each run = { id, dateRange:{start,end}, managerIds:[], subordinateIds:[], paidAt }
  const [counts,  setCounts]  = useState({});    // maps run.id → number of paid reports
  const [loading, setLoading] = useState(true);

  // 2) Store the actual subordinates array from the users collection
  const [managerSubCids, setManagerSubCids] = useState([]);

  // (a) Fetch manager’s subordinates list once we know user is loaded
  useEffect(() => {
    if (authLoading) return;
    if (profile?.role !== 'manager' || !managerCompanyId) return;

    (async () => {
      const mgrUserQ = query(
        collection(db, 'users'),
        where('companyId', '==', managerCompanyId)
      );
      const mgrUserSnap = await getDocs(mgrUserQ);
      if (!mgrUserSnap.empty) {
        const mgrData = mgrUserSnap.docs[0].data();
        const subsArr = Array.isArray(mgrData.subordinates)
                          ? mgrData.subordinates
                          : [];
        setManagerSubCids(subsArr);
      } else {
        setManagerSubCids([]);
      }
    })();
  }, [authLoading, profile, managerCompanyId]);

  // (b) Fetch paymentHistory runs and their counts, after we have managerSubCids
  useEffect(() => {
    if (authLoading) return;
    if (profile?.role !== 'manager' || !managerCompanyId) return;
    if (managerSubCids === null) return; // ensure state set

    (async () => {
      setLoading(true);

      // 1) Fetch all paymentHistory docs where managerIds array‐contains this managerCompanyId
      const runsQ = query(
        collection(db, 'paymentHistory'),
        where('managerIds', 'array-contains', managerCompanyId)
      );
      const runsSnap = await getDocs(runsQ);
      let runDocs  = runsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // 1.1) Filter out runs where managerIds and subordinateIds each only contain this manager’s own ID
      runDocs = runDocs.filter(run => {
        const mIds = run.managerIds || [];
        const sIds = run.subordinateIds || [];
        // if both arrays have length 1 and both equal managerCompanyId, skip
        if (mIds.length === 1 && sIds.length === 1 &&
            mIds[0] === managerCompanyId && sIds[0] === managerCompanyId) {
          return false;
        }
        return true;
      });

      // 2) For each run, count how many paid reports from subordinates
      const newCounts = {};

      await Promise.all(
        runDocs.map(async (run) => {
          const startTS = run.dateRange.start;
          const endTS   = run.dateRange.end;

          if (!(managerSubCids.length)) {
            newCounts[run.id] = 0;
            return;
          }

          let paidCount = 0;
          // chunk subordinate IDs to max 10 per "in" query
          for (let i = 0; i < managerSubCids.length; i += 10) {
            const chunk = managerSubCids.slice(i, i + 10);
            const rptQ = query(
              collection(db, 'reports'),
              where('companyId', 'in', chunk),
              where('createdAt',    '>=', startTS    || Timestamp.now()),
              where('createdAt',    '<=', endTS      || Timestamp.now()),
              where('paymentStatus','==','paid'),
              where('managerCommission','==','paid')
            );
            const rptSnap = await getDocs(rptQ);
            paidCount += rptSnap.size;
          }
          newCounts[run.id] = paidCount;
        })
      );

      setRuns(runDocs);
      setCounts(newCounts);
      setLoading(false);
    })();
  }, [authLoading, profile, managerCompanyId, managerSubCids]);

  // 3) Loading / auth guards
  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Loading payment history…</p>
      </div>
    );
  }
  if (profile?.role !== 'manager' || !managerCompanyId) {
    return <Navigate to="/" replace />;
  }

  // 4) If there are no runs, show “No payment runs found.”
  if (!runs.length) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold">Manager Payment History</h2>
        <p className="mt-4 text-gray-500">No payment runs found.</p>
      </div>
    );
  }

  // Navigate to breakup, passing subordinate IDs
  const goToBreakup = (run) => {
    navigate(
      `/manager-payment-breakup/${run.id}`,
      { state: { run, managerSubCids } }
    );
  };

  return (
    <div className="p-6">
        <br /><br />
      <h2 className="text-2xl font-extrabold text-[#8a1ccf] mb-4">My Team's Payment History</h2>
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              {[
                'Paid Date/Period',
                'Paid On',
                'Subordinate IDs',
                'Sale Quantity by Team',
                'My Incentives',
                'Actions'
              ].map((hdr) => (
                <th
                  key={hdr}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                >
                  {hdr}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="bg-white divide-y divide-gray-200">
            {runs.map((run, idx) => {
              const startDate = run.dateRange.start.toDate();
              const endDate   = run.dateRange.end.toDate();
              const paidCount = counts[run.id] || 0;

              return (
                <tr
                  key={run.id}
                  className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                >
                  {/* 1) Paid Date/Period */}
                  <td className="px-6 py-3 text-sm text-gray-800">
                    {startDate.toLocaleDateString()} – {endDate.toLocaleDateString()}
                  </td>

                  {/* 2) Paid On */}
                  <td className="px-6 py-3 text-sm text-gray-800">
                    {run.paidAt.toDate().toLocaleString()}
                  </td>

                  {/* 3) Subordinate IDs */}
                  <td className="px-6 py-3 text-sm text-gray-800">
                    {managerSubCids.length
                      ? managerSubCids.join(', ')
                      : 'None'}
                  </td>

                  {/* 4) Sale Quantity by Team */}
                  <td className="px-6 py-3 text-sm text-gray-800">
                    {paidCount}
                  </td>

                  {/* 5) My Incentives */}
                  <td className="px-6 py-3 text-sm text-gray-800">
                    ₹{paidCount * 500}
                  </td>

                  {/* 6) Actions → View Breakup */}
                  <td className="px-6 py-3 text-sm">
                    <button
                      onClick={() => goToBreakup(run)}
                      className="px-3 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600 text-sm"
                    >
                      View Breakup
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
