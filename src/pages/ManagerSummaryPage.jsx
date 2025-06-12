import React, { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useUserProfile } from '../hooks/useUserProfile';
import DateRangePicker from '../Components/DateRangePicker';
import { db } from '../firebase';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp
} from 'firebase/firestore';
import * as XLSX from 'xlsx';

export default function ManagerSummaryPage() {
  const { profile, loading: authLoading } = useUserProfile();
  const { state } = useLocation();
  const { manager, range } = state || {};
  const navigate = useNavigate();

  const [customRange, setCustomRange] = useState({
    start: toJSDate(range?.start),
    end:   toJSDate(range?.end)
  });
  const [subs, setSubs]       = useState([]);
  const [loading, setLoading] = useState(true);

  const toTS = v =>
    v instanceof Timestamp
      ? v
      : v?.seconds != null
        ? Timestamp.fromMillis(v.seconds * 1000)
        : v instanceof Date
          ? Timestamp.fromDate(v)
          : null;

  function toJSDate(v) {
    if (v instanceof Timestamp) return v.toDate();
    if (v instanceof Date) return v;
    if (v?.seconds != null) return new Date(v.seconds * 1000);
    return null;
  }

  useEffect(() => {
    if (authLoading) return;
    if (!manager || profile?.role !== 'telecaller') return;

    (async () => {
      setLoading(true);
      const startTS = toTS(range.start);
      const endTS   = toTS(range.end);

      // build array: manager + direct subs
      const usersSnap = await getDocs(
        query(collection(db,'users'), where('supervisorId','==', manager.companyId))
      );
      const team = usersSnap.docs.map(d => ({ uid:d.id, ...d.data() }));
      // prepend manager
      team.unshift({ uid:manager.uid, name:manager.name, companyId:manager.companyId });

      // count each
      const enriched = await Promise.all(
        team.map(async u => {
          const rptQ = query(
            collection(db,'reports'),
            where('userId','==',u.uid),
            where('createdAt','>=',startTS),
            where('createdAt','<=',endTS)
          );
          const rptSnap = await getDocs(rptQ);
          let total=0, approved=0, pending=0, rejected=0;
          rptSnap.docs.forEach(d => {
            total++;
            const s = (d.data().status||'').toLowerCase();
            if (s==='approved') approved++;
            else if (s==='pending') pending++;
            else if (s==='rejected') rejected++;
          });
          return { ...u, total, approved, pending, rejected };
        })
      );

      setSubs(enriched);
      setLoading(false);
    })();
  }, [authLoading, manager, profile, range]);

  if (authLoading || loading) {
    return <p className="p-6 text-gray-400 animate-pulse">Loading…</p>;
  }
  if (!manager || profile?.role !== 'telecaller') {
    return <Navigate to="/" replace />;
  }

  const startDate = toJSDate(range.start)?.toLocaleDateString();
  const endDate   = toJSDate(range.end)?.toLocaleDateString();

  const handleDownload = () => {
    const rows = subs.map((u,i)=>({
      'S.No.':      i+1,
      'Officer ID': u.companyId,
      'Name':       u.name,
      'Total':      u.total,
      'Approved':   u.approved,
      'Pending':    u.pending,
      'Rejected':   u.rejected
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Team Summary');
    const fmt = d => d.toISOString().slice(0,10);
    const s = fmt(toJSDate(range.start)), e = fmt(toJSDate(range.end));
    XLSX.writeFile(wb, `${manager.companyId}_${s}_to_${e}_summary.xlsx`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-purple-50 p-6">
      <button
        onClick={() => navigate(-1)}
        className="text-purple-600 hover:underline mb-4"
      >
        &larr; Back
      </button>

      <h2 className="text-3xl font-extrabold text-purple-800 mb-1">
        Team under {manager.name} ({manager.companyId})
      </h2>
      <p className="text-gray-600 mb-4">
        Period: {startDate} – {endDate}
      </p>

      <div className="mb-4 max-w-md">
       
      </div>

      <button
        onClick={handleDownload}
        className="mb-6 px-4 py-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition"
      >
        Download Summary
      </button>

      <div className="overflow-x-auto bg-white rounded-2xl shadow-xl">
        <table className="min-w-full">
          <thead className="bg-indigo-100">
            <tr>
              {['S.No','ID','Name','Total','Approved','Pending','Rejected'].map(h => (
                <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-indigo-600 uppercase">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {subs.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-500">
                  No reports in this period.
                </td>
              </tr>
            ) : (
              subs.map((u,i) => (
                <tr key={u.uid} className={i%2?'bg-purple-50':'bg-white'}>
                  <td className="px-5 py-3 font-medium text-indigo-700">{i+1}</td>
                  <td className="px-5 py-3 text-indigo-600">{u.companyId}</td>
                  <td className="px-5 py-3">{u.name}</td>
                  <td className="px-5 py-3">{u.total}</td>
                  <td className="px-5 py-3 text-green-600">{u.approved}</td>
                  <td className="px-5 py-3 text-yellow-500">{u.pending}</td>
                  <td className="px-5 py-3 text-red-500">{u.rejected}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
