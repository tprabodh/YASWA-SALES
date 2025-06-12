// src/pages/ManagerPaidReportsPage.jsx

import React, { useEffect, useState } from 'react';
import {
  Navigate,
  useLocation,
  useNavigate
} from 'react-router-dom';
import { useUserProfile } from '../hooks/useUserProfile';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';

export default function ManagerPaidReportsPage() {
  const { profile, loading: authLoading } = useUserProfile();
  const { state }       = useLocation();
  // <-- Destructure subordinateCid (not "subordinate")
  const { range, subordinateCid } = state || {};
  const navigate        = useNavigate();
  const companyId       = profile?.companyId;

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  // Helper to rehydrate Timestamps if they were passed as plain objects
  const toTimestamp = (val) => {
    if (val instanceof Timestamp) return val;
    if (val?.seconds != null)     return Timestamp.fromMillis(val.seconds * 1000);
    return null;
  };

  useEffect(() => {
    console.log("ManagerPaidReportsPage useEffect start");
    if (authLoading) {
      console.log("still authLoading, exiting");
      return;
    }
    // Must be a manager, have a companyId, and a date range
    if (profile?.role !== 'manager' || !companyId || !range) {
      console.warn("Missing manager role, companyId, or range:", { role: profile?.role, companyId, range });
      setLoading(false);
      return;
    }
    // Also require subordinateCid explicitly:
    if (!subordinateCid) {
      console.warn("Missing subordinateCid in state:", state);
      setLoading(false);
      return;
    }

    const startTS = toTimestamp(range.start);
    const endTS   = toTimestamp(range.end);
    console.log("startTS:", startTS, "endTS:", endTS);
    if (!startTS || !endTS) {
      console.warn('Invalid range passed to ManagerPaidReportsPage:', range);
      setLoading(false);
      return;
    }

    (async () => {
      console.log("Querying paid reports for subordinateCid:", subordinateCid);
      // 1) Query all reports for that subordinateCid in the period, with both paid statuses
      let rptQ = query(
        collection(db, 'reports'),
        where('companyId',        '==', subordinateCid),
        where('createdAt',        '>=', startTS),
        where('createdAt',        '<=', endTS),
        where('paymentStatus',    '==', 'paid'),
        where('managerCommission','==', 'paid')
      );

      const rptSnap = await getDocs(rptQ);
      console.log("Raw reports fetched:", rptSnap.size);
      const raw     = rptSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      if (raw.length === 0) {
        setReports([]);
        setLoading(false);
        return;
      }

      // 2) Batch lookup officer names
      const cids = [...new Set(raw.map(r => r.companyId))];
      console.log("Unique officer companyIds:", cids);
      const nameMap = {};
      for (let i = 0; i < cids.length; i += 10) {
        const chunk = cids.slice(i, i + 10);
        const uSnap = await getDocs(
          query(collection(db, 'users'), where('companyId', 'in', chunk))
        );
        uSnap.docs.forEach(d => {
          const data = d.data();
          nameMap[data.companyId] = data.name;
        });
      }

      // 3) Combine name into each report
      const withNames = raw.map(r => ({
        ...r,
        officerName: nameMap[r.companyId] || '—'
      }));

      console.log("With names:", withNames);
      setReports(withNames);
      setLoading(false);
    })();
  }, [authLoading, profile, companyId, range, subordinateCid, state]);

  // --- Loading & auth guards ---
  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Loading paid reports…</p>
      </div>
    );
  }
  if (profile?.role !== 'manager') {
    return <Navigate to="/" replace />;
  }
  if (!companyId || !range) {
    return <p className="p-6 text-red-500">Missing date range or permissions.</p>;
  }

  return (
    <div className="p-6">
      <br /><br />
      <h2 className="text-2xl font-bold mb-4">
        Paid Reports for {profile.name}
      </h2>

      {reports.length === 0 ? (
        <p className="text-gray-500">No paid reports in this period.</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                {[
                  'Officer ID',
                  'Officer Name',
                  'Student',
                  'Grade',
                  'Course',
                  'Created At',
                  'Actions'
                ].map(h => (
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
              {reports.map(r => (
                <tr key={r.id}>
                  <td className="px-4 py-2">{r.companyId}</td>
                  <td className="px-4 py-2">{r.officerName}</td>
                  <td className="px-4 py-2">{r.studentName}</td>
                  <td className="px-4 py-2">{r.grade}</td>
                  <td className="px-4 py-2">{r.course}</td>
                  <td className="px-4 py-2">
                    {r.createdAt.toDate().toLocaleString()}
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => navigate(`/view/${r.id}`)}
                      className="px-2 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600 text-sm"
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
  );
}
