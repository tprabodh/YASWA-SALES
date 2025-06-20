// src/pages/ManagerDashboardPage.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  Timestamp,
  collection,
  getDocs,
  query,
  where
} from 'firebase/firestore';
import { useUserProfile } from '../hooks/useUserProfile';
import DateRangePicker    from '../Components/DateRangePicker';
import * as XLSX          from 'xlsx';
import { db }             from '../firebase';

function getDateRange(type, custom) {
  const now = new Date();
  let start, end;

  if (type === 'today') {
    start = new Date(now); start.setHours(0,0,0,0);
    end   = new Date(now); end.setHours(23,59,59,999);
  } else if (type === 'yesterday') {
    const d = new Date(now); d.setDate(d.getDate() - 1);
    start = new Date(d); start.setHours(0,0,0,0);
    end   = new Date(d); end.setHours(23,59,59,999);
  } else if (type === 'thisWeek') {
    const day = now.getDay(), diff = (day + 6) % 7;
    start = new Date(now); start.setDate(now.getDate() - diff); start.setHours(0,0,0,0);
    end   = new Date(start); end.setDate(start.getDate() + 6);    end.setHours(23,59,59,999);
  } else if (type === 'thisMonth') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end   = new Date(now.getFullYear(), now.getMonth()+1, 0);
    start.setHours(0,0,0,0);
    end.setHours(23,59,59,999);
  } else if (type === 'custom' && custom.start && custom.end) {
    start = custom.start;
    end   = custom.end;
  } else {
    start = new Date(now); start.setHours(0,0,0,0);
    end   = new Date(now); end.setHours(23,59,59,999);
  }
  return { start, end };
}

export default function ManagerDashboardPage() {
  const { profile, loading: authLoading } = useUserProfile();
  const navigate = useNavigate();

  const [dateType, setDateType]        = useState('today');
  const [customRange, setCustomRange]  = useState({ start: null, end: null });
  const [team, setTeam]                = useState([]);
  const [loading, setLoading]          = useState(true);

  const { start, end } = useMemo(
    () => getDateRange(dateType, customRange),
    [dateType, customRange]
  );
  const bStart = useMemo(() => Timestamp.fromDate(start), [start]);
  const bEnd   = useMemo(() => Timestamp.fromDate(end),   [end]);

  useEffect(() => {
    if (authLoading) return;
    if (!profile?.companyId) return;
    setLoading(true);

    (async () => {
      // 1) include manager themself
      const base = [{
        uid:       profile.uid,
        name:      profile.name,
        companyId: profile.companyId
      }];

      // 2) fetch direct reports
      const usSnap = await getDocs(
        query(collection(db,'users'), where('supervisorId','==', profile.companyId))
      );
      const users = usSnap.docs.map(d => ({
        uid:       d.id,
        name:      d.data().name || '—',
        companyId: d.data().companyId || '—'
      }));

      const fullTeam = [...base, ...users];

      // 3) tally each
      const enriched = await Promise.all(
        fullTeam.map(async u => {
          const rptSnap = await getDocs(
            query(
              collection(db,'reports'),
              where('companyId','==', u.companyId),
              where('createdAt','>=', bStart),
              where('createdAt','<=', bEnd)
            )
          );
          const docs = rptSnap.docs.map(d=>d.data());
          const total    = docs.length;
          const approved = docs.filter(r=>r.status.toLowerCase()==='approved').length;
          const rejected = docs.filter(r=>r.status.toLowerCase()==='rejected').length;
          const pending  = docs.filter(r=>r.status.toLowerCase()==='pending').length;
          return { ...u, total, approved, rejected, pending };
        })
      );

      // sort by total desc
      enriched.sort((a,b) => b.total - a.total);

      setTeam(enriched);
      setLoading(false);
    })();
  }, [authLoading, profile, bStart, bEnd]);

  // guard
  if (!authLoading && !profile?.companyId) {
    return <Navigate to="/" replace />;
  }
  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Loading…</p>
      </div>
    );
  }

  const handleDownload = async () => {
    let rows = [];
    for (let u of team) {
      const snap = await getDocs(
        query(
          collection(db,'reports'),
          where('companyId','==', u.companyId),
          where('createdAt','>=', bStart),
          where('createdAt','<=', bEnd)
        )
      );
      snap.docs.forEach(d => {
        const r = d.data();
        rows.push({
          'Officer ID':    u.companyId,
          'Officer Name':  u.name,
          'Student':       r.studentName,
          'Grade':         r.grade,
          'Course':        r.course,
          'Status':        r.status,
          'Created At':    r.createdAt.toDate().toLocaleString(),
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
      <br /><br />
      <h2 className="text-2xl font-extrabold text-[#8a1ccf] mb-4">
        Team under {profile.name} ({profile.companyId})
      </h2>

      {/* Date picker */}
      <div className="mb-6 max-w-md">
        <DateRangePicker
          value={dateType}
          onChangeType={setDateType}
          customRange={customRange}
          onChangeCustom={delta => setCustomRange(cr=>({...cr,...delta}))}
        />
      </div>

      <div className="overflow-x-auto bg-white rounded-lg shadow-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-200">
            <tr>
              {[
                'S. No.', 'Name', 'Consultant ID',
                'Total Reports', 'Approved', 'Rejected', 'Pending', 'Actions'
              ].map(h => (
                <th key={h}
                  className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {team.map((u, i) => (
              <tr key={u.uid}
                  className="hover:bg-gray-100 transition-colors">
                <td className="px-6 py-4 text-sm text-gray-900">{i+1}</td>
                <td className="px-6 py-4 text-sm text-gray-900">{u.name}</td>
                <td className="px-6 py-4 text-sm text-gray-900">{u.companyId}</td>
                <td className="px-6 py-4 text-sm font-medium text-indigo-600">{u.total}</td>
                <td className="px-6 py-4 text-sm font-medium text-green-600">{u.approved}</td>
                <td className="px-6 py-4 text-sm font-medium text-red-600">{u.rejected}</td>
                <td className="px-6 py-4 text-sm font-medium text-orange-500">{u.pending}</td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => navigate(`/summary/${u.uid}`, { state: { range:{ start, end } } })}
                    className="px-3 py-1 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-300 text-sm"
                  >
                    View Reports
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Download */}
      <div className="mt-6">
        <button
          onClick={handleDownload}
          className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition"
        >
          Download Reports
        </button>
      </div>
    </div>
  );
}
