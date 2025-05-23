// src/pages/ManagerDashboardPage.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Timestamp, collection, getDocs, query, where } from 'firebase/firestore';
import { useUserProfile } from '../hooks/useUserProfile';
import DateRangePicker from '../Components/DateRangePicker';
import * as XLSX from 'xlsx';
import { db } from '../firebase';

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
    // our customRange.start/end already have correct hours
    return { start: custom.start, end: custom.end };
  }
  // fallback to today
  const s = new Date(now); s.setHours(0,0,0,0);
  const e = new Date(now); e.setHours(23,59,59,999);
  return { start: s, end: e };
}

export default function ManagerDashboardPage() {
  const { profile, loading: authLoading } = useUserProfile();
  const navigate = useNavigate();

  // Date‐picker state
  const [dateType,    setDateType]    = useState('last7');
  const [customRange, setCustomRange] = useState({ start: null, end: null });

  // Team state
  const [team,    setTeam]    = useState([]); 
  const [loading, setLoading] = useState(true);

  // Compute date bounds and Firestore timestamps
  const { start, end } = useMemo(
    () => getDateRange(dateType, customRange),
    [dateType, customRange]
  );
  const bStart = useMemo(() => Timestamp.fromDate(start), [start]);
  const bEnd   = useMemo(() => Timestamp.fromDate(end),   [end]);

  // Fetch whenever profile or date range changes
  useEffect(() => {
    if (authLoading) return;
    if (!profile?.companyId) return;  // not a manager
    setLoading(true);

    (async () => {
       const base = [{
       uid:       profile.uid,
       name:      profile.name || '—',
       companyId: profile.companyId
     }];

     // 1) Start with the manager themselves
    

      // 1) Lookup subordinate users by companyId
     

      const subs = Array.isArray(profile.subordinates)
       ? profile.subordinates
       : [];
     const users = await Promise.all(
       subs.map(async cid => {
         const usSnap = await getDocs(
           query(collection(db,'users'), where('companyId','==', cid))
         );
         if (usSnap.empty) return null;
         const d = usSnap.docs[0];
         return { uid: d.id, name: d.data().name||'—', companyId: cid };
       })
     );
     const validUsers = users.filter(Boolean);

      // 2) Count reports + allApproved per user
      const fullTeam = [...base, ...validUsers];
     const enriched = await Promise.all(
       fullTeam.map(async u => {
          let rQ = query(
            collection(db,'reports'),
            where('companyId','==', u.companyId),
            where('createdAt','>=', bStart),
            where('createdAt','<=', bEnd)
          );
          const snap = await getDocs(rQ);
          const docs = snap.docs.map(d => d.data());
          const count = docs.length;
          const allApproved = count > 0 && docs.every(r => r.status.toLowerCase() === 'approved');
         return { ...u, reportCount: count, allApproved };
        })
      );

      // 3) Sort by name
      enriched.sort((a,b) => a.name.localeCompare(b.name));
      setTeam(enriched);
      setLoading(false);
    })();
  }, [authLoading, profile, bStart, bEnd]);

  // Redirect if not a manager
  if (!authLoading && !profile?.companyId) {
    return <Navigate to="/" replace />;
  }

  // Loading state
  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Loading…</p>
      </div>
    );
  }

  // Download all reports in the selected range
  const handleDownload = async () => {
    let rows = [];
    for (let u of team) {
      const snaps = await getDocs(
        query(
          collection(db,'reports'),
          where('companyId','==', u.companyId),
          where('createdAt','>=', bStart),
          where('createdAt','<=', bEnd)
        )
      );
      snaps.docs.forEach(d => {
        const r = d.data();
        rows.push({
          'Officer ID':   u.companyId,
          'Officer Name': u.name,
          'Student':      r.studentName,
          'Grade':        r.grade,
          'Course':       r.course,
          'Status':       r.status,
          'Created At':   r.createdAt.toDate().toLocaleString(),
        });
      });
    }
    if (!rows.length) {
      alert('No reports in this range.');
      return;
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reports');
    const f1 = start.toISOString().slice(0,10);
    const f2 = end.toISOString().slice(0,10);
    XLSX.writeFile(wb, `${profile.companyId}_${f1}${f1!==f2?`_to_${f2}`:''}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
        <br />
        <br />
      <h2 className="text-2xl font-bold mb-4">
        Team under {profile.name} ({profile.companyId})
      </h2>

      {/* Date Picker */}
      <div className="mb-6 max-w-md">
        <DateRangePicker
          value={dateType}
          onChangeType={setDateType}
          customRange={customRange}
          onChangeCustom={delta =>
            setCustomRange(cr => ({ ...cr, ...delta }))
          }
        />
      </div>

      {/* Team Table */}
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              {['Name','Company ID','# Reports','All Approved','Actions'].map(h=>(
                <th key={h}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                >{h}</th>
              ))}
            </tr>
          </thead>
         <tbody className="bg-white divide-y divide-gray-200">
  {team.map((u,i) => (
    <tr key={u.uid} className={i%2===0?'bg-white':'bg-gray-50'}>
      <td className="px-6 py-4 text-sm text-gray-900">{u.name}</td>
      <td className="px-6 py-4 text-sm text-gray-900">{u.companyId}</td>
      <td className="px-6 py-4 text-sm text-gray-900">{u.reportCount}</td>
      <td className="px-6 py-4 text-sm text-gray-900">
        {u.allApproved ? 'Yes' : 'No'}
      </td>
      {/* ← New “View Reports” column */}
      <td className="px-6 py-4">
        <button
          onClick={() =>
            navigate(`/summary/${u.uid}`, {
              state: { range: { start, end } }
            })
          }
          className="px-3 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600 text-sm"
        >
          View&nbsp;Reports
        </button>
      </td>
    </tr>
  ))}
</tbody>

        </table>
      </div>

      {/* Download Button */}
      <div className="mt-6">
        <button
          onClick={handleDownload}
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          Download Reports
        </button>
      </div>
    </div>
  );
}
