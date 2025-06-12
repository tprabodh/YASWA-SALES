// src/pages/MyBusinessHeadsPage.jsx

import React, { useEffect, useState } from 'react';
import { Navigate }              from 'react-router-dom';
import { useUserProfile }        from '../hooks/useUserProfile';
import DateRangePicker           from '../Components/DateRangePicker';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { db }                    from '../firebase';
import { getDateRange }          from '../utils/dateUtils';
import * as XLSX                 from 'xlsx';
import { saveAs }                from 'file-saver';

export default function MyBusinessHeadsPage() {
  const { profile, loading: authLoading } = useUserProfile();
  const [dateType,    setDateType]    = useState('today');
  const [customRange, setCustomRange] = useState({ start: null, end: null });
  const [rows,        setRows]        = useState([]);
  const [loading,     setLoading]     = useState(true);

  // Compute JS dates + Firestore Timestamps
  const { start: jsStart, end: jsEnd } = getDateRange(dateType, customRange);
  const bStart = Timestamp.fromDate(jsStart);
  const bEnd   = Timestamp.fromDate(jsEnd);

  useEffect(() => {
    if (authLoading) return;
    if (!profile || profile.role !== 'salesHead') return;

    (async () => {
      setLoading(true);

      const bhCids = Array.isArray(profile.myBusinessHeads)
        ? profile.myBusinessHeads
        : [];

      const summary = [];

      for (let bhCid of bhCids) {
        // 1) Lookup BH doc for name + telecallers[]
        const bhSnap = await getDocs(
          query(collection(db, 'users'), where('companyId','==', bhCid))
        );
        if (bhSnap.empty) continue;
        const bhData      = bhSnap.docs[0].data();
        const bhName      = bhData.name || '—';
        const telecallers = bhData.telecallers || [];

        // 2) Gather all manager CIDs under those telecallers
        let managerCids = [];
        for (let teleCid of telecallers) {
          const teleSnap = await getDocs(
            query(collection(db, 'users'), where('companyId','==', teleCid))
          );
          if (teleSnap.empty) continue;
          managerCids.push(...(teleSnap.docs[0].data().managing || []));
        }
        managerCids = Array.from(new Set(managerCids));

        // 3) Gather all subordinates under those managers
        let subordinateCids = [];
        for (let mgrCid of managerCids) {
          const mgrSnap = await getDocs(
            query(collection(db, 'users'), where('companyId','==', mgrCid))
          );
          if (mgrSnap.empty) continue;
          subordinateCids.push(...(mgrSnap.docs[0].data().subordinates || []));
        }
        subordinateCids = Array.from(new Set(subordinateCids));

        // 4) Combine both lists
        const allCids = Array.from(new Set([...managerCids, ...subordinateCids]));
        let approved = 0, pending = 0, rejected = 0;

        // 5) For each chunk of up to 10 CIDs, tally statuses
        for (let i = 0; i < allCids.length; i += 10) {
          const chunk = allCids.slice(i, i + 10);
          const rSnap = await getDocs(
            query(
              collection(db,'reports'),
              where('companyId','in', chunk),
              where('createdAt','>=', bStart),
              where('createdAt','<=', bEnd)
            )
          );
          rSnap.docs.forEach(d => {
            const st = d.data().status?.toLowerCase();
            if (st === 'approved') approved++;
            else if (st === 'pending') pending++;
            else if (st === 'rejected') rejected++;
          });
        }

        summary.push({
          bhCid,
          bhName,
          total: approved + pending + rejected,
          approved,
          pending,
          rejected
        });
      }

      setRows(summary);
      setLoading(false);
    })();
  }, [authLoading, profile, dateType, customRange]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Loading…</p>
      </div>
    );
  }
  if (!profile || profile.role !== 'salesHead') {
    return <Navigate to="/" replace />;
  }
  if (!Array.isArray(profile.myBusinessHeads) || profile.myBusinessHeads.length === 0) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">My Business Heads</h2>
        <p className="text-gray-500">You have not been assigned any Business Heads.</p>
      </div>
    );
  }

  const handleDownloadSummary = () => {
    if (!rows.length) {
      alert('No data to download for this range.');
      return;
    }
    const sheetData = rows.map(r => ({
      'S.No':            r.bhCid,    // placeholder—XLSX ignores key ordering
      'BusinessHeadID':  r.bhCid,
      'BusinessHeadName':r.bhName,
      'Total Reports':   r.total,
      'Approved':        r.approved,
      'Pending':         r.pending,
      'Rejected':        r.rejected
    }));
    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Summary');
    const fmt = d => d.toISOString().slice(0,10);
    const base = `${profile.companyId}_${fmt(jsStart)}_to_${fmt(jsEnd)}`;
    XLSX.writeFile(wb, `${base}_BH_Summary.xlsx`);
  };

  return (
    <div className="p-6 space-y-6">
      <br /><br />
      <h2 className="text-2xl font-bold mb-4">
  {profile.name} ({profile.companyId})'s Dashboard
</h2>
     

      <div className="max-w-md">
        <DateRangePicker
          value={dateType}
          onChangeType={setDateType}
          customRange={customRange}
          onChangeCustom={delta => setCustomRange(cr=>({ ...cr, ...delta }))}
        />
      </div>

      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              {['S.No','BusinessHeadID','BusinessHeadName','Total Reports','Approved','Pending','Rejected'].map(col => (
                <th key={col} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rows.map((r, idx) => (
              <tr key={r.bhCid} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-6 py-4 text-sm text-gray-800">{idx+1}</td>
                <td className="px-6 py-4 text-sm text-gray-800">{r.bhCid}</td>
                <td className="px-6 py-4 text-sm text-gray-800">{r.bhName}</td>
                <td className="px-6 py-4 text-sm text-gray-800">{r.total}</td>
                <td className="px-6 py-4 text-sm text-green-600 font-semibold">{r.approved}</td>
                <td className="px-6 py-4 text-sm text-yellow-600 font-semibold">{r.pending}</td>
                <td className="px-6 py-4 text-sm text-red-600 font-semibold">{r.rejected}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={handleDownloadSummary}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Download Summary
      </button>
    </div>
  );
}
