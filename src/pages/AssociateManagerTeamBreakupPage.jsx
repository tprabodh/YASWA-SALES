// src/pages/AssociateManagerTeamBreakupPage.jsx

import React, { useEffect, useState } from 'react';
import { Navigate, useLocation }      from 'react-router-dom';
import { useUserProfile }             from '../hooks/useUserProfile';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { db }                          from '../firebase';
import DateRangePicker                 from '../Components/DateRangePicker';
import * as XLSX                       from 'xlsx';
import { saveAs }                      from 'file-saver';
import { getDateRange }                from '../utils/dateUtils';

export default function AssociateManagerTeamBreakupPage() {
  const { profile, loading }      = useUserProfile();
  const { state }                 = useLocation();
  const { range }                 = state || {};
  // ─ Use 'today' by default so that we show today's paid reports if no range was passed:
  const [dateType, setDateType]   = useState('today');
  const [customRange, setCustomRange] = useState(
    // If someone did pass a `range` in state, prefill it; otherwise nulls:
    range
      ? {
          start: range.start instanceof Timestamp ? range.start.toDate() : range.start,
          end:   range.end   instanceof Timestamp ? range.end.toDate()   : range.end
        }
      : { start: null, end: null }
  );
  const [breakupRows, setBreakupRows]   = useState([]);
  const [loadingData, setLoadingData]   = useState(true);

  useEffect(() => {
    (async () => {
      // 1) Wait for profile to load
      if (loading) {
        return;
      }
      // 2) Only associate managers are allowed here
      if (!profile || profile.role !== 'associateManager') {
        return;
      }

      // 3) Compute JS Date bounds from dateType/customRange
      const { start: jsStart, end: jsEnd } = getDateRange(dateType, customRange);

      // If getDateRange gave us nulls (should not happen if dateType !== 'custom' or if customRange is fully set),
      // bail out with an empty result:
      if (!jsStart || !jsEnd) {
        setBreakupRows([]);
        setLoadingData(false);
        return;
      }

      // 4) Convert to Firestore Timestamps
      const startTS = jsStart instanceof Timestamp ? jsStart : Timestamp.fromDate(jsStart);
      const endTS   = jsEnd   instanceof Timestamp ? jsEnd   : Timestamp.fromDate(jsEnd);

      setLoadingData(true);

      // 5) Grab all associate CIDs under this associate manager
      const assocCids = Array.isArray(profile.associates) ? profile.associates : [];
      if (assocCids.length === 0) {
        setBreakupRows([]);
        setLoadingData(false);
        return;
      }

      // 6) Chunk in groups of 10 (Firestore “in” limit)
      const cidChunks = [];
      for (let i = 0; i < assocCids.length; i += 10) {
        cidChunks.push(assocCids.slice(i, i + 10));
      }

      // 7) Fetch “paid” reports (associatePayment=='paid' AND associateManagerPayment=='paid')
      const allPaidReports = [];
      for (let chunk of cidChunks) {
        const rptQ = query(
          collection(db, 'reports'),
          where('companyId', 'in', chunk),
          where('createdAt', '>=', startTS),
          where('createdAt', '<=', endTS),
          where('associatePayment',        '==', 'paid'),
          where('associateManagerPayment', '==', 'paid')
        );
        const snap = await getDocs(rptQ);
        snap.docs.forEach(d => {
          allPaidReports.push({
            id: d.id,
            ...d.data()
          });
        });
      }

      // 8) Group by associate-CID
      const byAssociate = {};
      allPaidReports.forEach(rpt => {
        const cid = rpt.companyId;
        if (!byAssociate[cid]) {
          byAssociate[cid] = {
            cid,
            name: '—',
            total: 0,
            approved: 0,
            pending: 0,
            rejected: 0,
            rows: []
          };
        }
        const bucket = byAssociate[cid];
        bucket.total++;
        const st = (rpt.status || '').toLowerCase();
        if (st === 'approved') bucket.approved++;
        else if (st === 'pending') bucket.pending++;
        else if (st === 'rejected') bucket.rejected++;

        bucket.rows.push({
          reportId:    rpt.id,
          studentName: rpt.studentName || '',
          course:      rpt.course || '',
          status:      rpt.status || '',
          createdAt:   rpt.createdAt.toDate().toLocaleString()
        });
      });

      // 9) Look up each associate’s name in batches of 10
      const paidCids = Object.keys(byAssociate);
      if (paidCids.length > 0) {
        const nameChunks = [];
        for (let i = 0; i < paidCids.length; i += 10) {
          nameChunks.push(paidCids.slice(i, i + 10));
        }
        for (let chunk of nameChunks) {
          const userQ = query(
            collection(db, 'users'),
            where('companyId', 'in', chunk)
          );
          const userSnap = await getDocs(userQ);
          userSnap.docs.forEach(d => {
            const data = d.data();
            const cid = data.companyId;
            if (byAssociate[cid]) {
              byAssociate[cid].name = data.name || '—';
            }
          });
        }
      }

      // 10) Create a sorted array of buckets
      const breakupArray = Object.values(byAssociate).sort((a, b) =>
        a.name.localeCompare(b.name)
      );

      setBreakupRows(breakupArray);
      setLoadingData(false);
    })();
  }, [
    loading,
    profile,
    dateType,
    customRange.start,
    customRange.end
  ]);

  // ─── Render-level guards ─────────────────────────────────

  if (loading) {
    return <p>Loading profile…</p>;
  }
  if (!profile || profile.role !== 'associateManager') {
    return <Navigate to="/" replace />;
  }
  if (loadingData) {
    return <p>Loading paid-breakup…</p>;
  }

  // ─── Download helper for one associate ─────────────────────────────────────

  const handleDownloadOneAssociate = (cid) => {
    const bucket = breakupRows.find(b => b.cid === cid);
    if (!bucket || bucket.rows.length === 0) {
      alert('No paid reports found for this associate in the chosen range.');
      return;
    }
    const sheetData = bucket.rows.map(r => ({
      'Report ID':    r.reportId,
      'Student Name': r.studentName,
      'Course':       r.course,
      'Status':       r.status,
      'Created At':   r.createdAt,
      'Associate CID':cid
    }));
    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'AssociateDetail');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(
      new Blob([wbout], { type: 'application/octet-stream' }),
      `associate_${cid}_breakup.xlsx`
    );
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">
        Associate-Manager → Team’s Paid Breakup
      </h2>

      <div className="mb-4 max-w-md">
        <DateRangePicker
          value={dateType}
          onChangeType={setDateType}
          customRange={customRange}
          onChangeCustom={({ start, end }) => {
            setCustomRange({ start, end });
          }}
        />
      </div>

      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              {[
                '#',
                'Associate (CID)',
                'Total Paid',
                'Approved',
                'Pending',
                'Rejected',
                'Actions'
              ].map(col => (
                <th
                  key={col}
                  className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {breakupRows.length > 0 ? (
              breakupRows.map((bucket, idx) => (
                <tr key={bucket.cid} className={idx % 2 ? 'bg-gray-50' : ''}>
                  <td className="px-4 py-2">{idx + 1}</td>
                  <td className="px-4 py-2">
                    {bucket.name} ({bucket.cid})
                  </td>
                  <td className="px-4 py-2">{bucket.total}</td>
                  <td className="px-4 py-2">{bucket.approved}</td>
                  <td className="px-4 py-2">{bucket.pending}</td>
                  <td className="px-4 py-2">{bucket.rejected}</td>
                  <td className="px-4 py-2 space-x-2">
                    <button
                      onClick={() => handleDownloadOneAssociate(bucket.cid)}
                      className="px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                    >
                      Download Breakup
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-4 py-4 text-center text-gray-500">
                  No paid associate reports found in this date range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
