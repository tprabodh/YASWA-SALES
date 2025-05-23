// src/pages/ManagerPaidReportsPage.jsx
import React, { useEffect, useState } from 'react';
import { useUserProfile }        from '../hooks/useUserProfile';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export default function ManagerPaidReportsPage() {
  const { profile, loading: authLoading } = useUserProfile();
  const { state }       = useLocation();
  const navigate        = useNavigate();
  const range           = state?.range;
  const companyId       = profile?.companyId;

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (profile?.role !== 'manager' || !companyId || !range) return;

    (async () => {
      const { start, end } = range;

      // 1) fetch all paid reports for this manager in [start,end]
      const rptQ = query(
        collection(db, 'reports'),
        where('managerId',         '==', companyId),
        where('createdAt',       '>=', start),
        where('createdAt',       '<=', end),
        where('paymentStatus',   '==','paid'),
        where('managerCommission','==','paid')
      );
      const rptSnap = await getDocs(rptQ);
      const raw = rptSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      if (raw.length === 0) {
        setReports([]);
        setLoading(false);
        return;
      }

      // 2) fetch officer names in bulk
      const cids = [...new Set(raw.map(r => r.companyId))];
      // Firestore limits 'in' to 10, so chunk if needed:
      const nameMap = {};
      for (let i = 0; i < cids.length; i += 10) {
        const slice = cids.slice(i, i + 10);
        const uQ = query(
          collection(db, 'users'),
          where('companyId', 'in', slice)
        );
        const uSnap = await getDocs(uQ);
        uSnap.docs.forEach(d => {
          nameMap[d.data().companyId] = d.data().name;
        });
      }

      // 3) combine
      const withNames = raw.map(r => ({
        ...r,
        officerName: nameMap[r.companyId] || '—'
      }));

      setReports(withNames);
      setLoading(false);
    })();
  }, [authLoading, profile, companyId, range]);

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
