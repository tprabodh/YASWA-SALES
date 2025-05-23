// src/pages/TelecallerDashboardPage.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useUserProfile } from '../hooks/useUserProfile';
import DateRangePicker from '../Components/DateRangePicker';
import { db } from '../firebase';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';

function getDateRange(type, custom) {
  const now = new Date();
  if (type === 'today') {
    const s = new Date(now); s.setHours(0,0,0,0);
    const e = new Date(now); e.setHours(23,59,59,999);
    return { start: s, end: e };
  }
  if (type === 'last7')  return { start: new Date(now - 6*864e5), end: now };
  if (type === 'last30') return { start: new Date(now - 29*864e5), end: now };
  if (type === 'custom' && custom.start && custom.end) {
    return { start: custom.start, end: custom.end };
  }
  // fallback
  const s = new Date(now); s.setHours(0,0,0,0);
  const e = new Date(now); e.setHours(23,59,59,999);
  return { start: s, end: e };
}

export default function TelecallerDashboardPage() {
  const { profile, loading: authLoading } = useUserProfile();
  const navigate = useNavigate();

  const [dateType, setDateType]    = useState('today');
  const [customRange, setCustomRange] = useState({ start: null, end: null });
  const [managers, setManagers]    = useState([]);
  const [loading, setLoading]      = useState(true);

  // Compute date bounds
  const { start, end } = useMemo(
    () => getDateRange(dateType, customRange),
    [dateType, customRange]
  );
  const bStart = useMemo(() => Timestamp.fromDate(start), [start]);
  const bEnd   = useMemo(() => Timestamp.fromDate(end),   [end]);

  

  useEffect(() => {
    if (authLoading) return;
    setLoading(true);

    (async () => {
      // 1) profile.managing is array of companyIds
      const mgrCompanyIds = profile.managing || [];

      // 2) load each manager’s user doc
      const mgrUsers = [];
      for (let cid of mgrCompanyIds) {
        const uSnap = await getDocs(
          query(collection(db, 'users'), where('companyId', '==', cid))
        );
        if (!uSnap.empty) {
          const doc = uSnap.docs[0];
          mgrUsers.push({
            uid: doc.id,
            name: doc.data().name,
            companyId: cid,
          });
        }
      }

      // 3) count their reports in window
     // inside your useEffect:
const enriched = await Promise.all(
  mgrUsers.map(async m => {
    // 1) manager’s own reports
    const ownQ = query(
      collection(db,'reports'),
      where('companyId','==', m.companyId),
      where('createdAt','>=', bStart),
      where('createdAt','<=', bEnd)
    );
    const ownSnap = await getDocs(ownQ);
    const ownCount = ownSnap.size;

    // 2) find all direct subordinates’ companyIds
    const subQ = query(
      collection(db,'users'),
      where('supervisorId','==', m.companyId)
    );
    const subSnap = await getDocs(subQ);
    const subCids = subSnap.docs.map(d => d.data().companyId).filter(Boolean);

    // 3) fetch their reports in chunks of 10
    let subCount = 0;
    for (let i = 0; i < subCids.length; i += 10) {
      const chunk = subCids.slice(i, i + 10);
      const repsQ = query(
        collection(db,'reports'),
        where('companyId','in', chunk),
        where('createdAt','>=', bStart),
        where('createdAt','<=', bEnd)
      );
      const repsSnap = await getDocs(repsQ);
      subCount += repsSnap.size;
    }

    const totalCount = ownCount + subCount;

    // 4) allApproved only if every one of those reports is approved
    const allDocs = [
      ...ownSnap.docs.map(d => d.data()),
      // and gather the sub-docs similarly if you need to test approval
    ];
    const allApproved = totalCount > 0
      && allDocs.every(r => r.status.toLowerCase() === 'approved');

    return {
      ...m,
      reportCount: totalCount,
      allApproved
    };
  })
);

      // 4) sort alpha
      enriched.sort((a,b) => a.name.localeCompare(b.name));
      setManagers(enriched);
      setLoading(false);
    })();
  }, [authLoading, profile?.managing, bStart, bEnd]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Loading…</p>
      </div>
    );
  }

  // Redirect non–telecallers
  if (!authLoading && profile?.role !== 'telecaller') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h2 className="text-2xl font-bold mb-4">
        Your Managers
      </h2>

      {/* Date picker */}
      <div className="mb-6 max-w-md">
        <DateRangePicker
          value={dateType}
          onChangeType={setDateType}
          customRange={customRange}
          onChangeCustom={delta => setCustomRange(cr => ({ ...cr, ...delta }))}
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              {['Name','Company ID','# Reports','All Approved','Actions'].map(h => (
                <th key={h}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {managers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                  No managers assigned.
                </td>
              </tr>
            )}
            {managers.map((m,i) => (
              <tr key={m.uid} className={i%2===0?'bg-white':'bg-gray-50'}>
                <td className="px-6 py-4 text-sm text-gray-900">{m.name}</td>
                <td className="px-6 py-4 text-sm text-gray-900">{m.companyId}</td>
                <td className="px-6 py-4 text-sm text-gray-900">{m.reportCount}</td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {m.allApproved ? 'Yes' : 'No'}
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => navigate(
                      `/admin/employee-summary/${m.uid}`,
                      { state: { manager: m, range: { start, end } } }
                    )}
                    className="px-3 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600 text-sm"
                  >
                    View Summary
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
