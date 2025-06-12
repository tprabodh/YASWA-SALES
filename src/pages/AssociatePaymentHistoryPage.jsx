// src/pages/AssociatePaymentHistoryPage.jsx

import React, { useEffect, useState, useRef } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useUserProfile }           from '../hooks/useUserProfile';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db }                       from '../firebase';
import * as XLSX                    from 'xlsx';
import { saveAs }                   from 'file-saver';
import Waves from '../styles/Waves';

export default function AssociatePaymentHistoryPage() {
  const { profile, loading } = useUserProfile();
  const navigate             = useNavigate();

  // page‐level state
  const [rows, setRows]             = useState([]);
  const [loadingData, setLoading]   = useState(true);
  const detailRef                   = useRef({});

  useEffect(() => {
    if (loading) return;             // wait until profile is loaded
    if (!profile || profile.role !== 'associate') return;

    (async () => {
      setLoading(true);

      // 1) Ensure we have the associate’s companyId
      const myCid = profile.companyId;
      if (!myCid) {
        setRows([]);
        setLoading(false);
        return;
      }

      // 2) Query all payment‐history docs where associateIds array contains myCid
      const histCol = collection(db, 'associatePaymentHistory');
      const q = query(histCol, where('associateIds', 'array-contains', myCid));
      const histSnap = await getDocs(q);

      const tempRows = [];
      const allDetails = {}; // store per‐historyId → detail for download

      for (let docSnap of histSnap.docs) {
        const data = docSnap.data();
        const histId = docSnap.id;

        // a) dateRange may or may not exist—guard against undefined
        let startDisplay = '—', endDisplay = '—';
        if (data.dateRange?.start instanceof Timestamp) {
          startDisplay = data.dateRange.start.toDate().toLocaleDateString();
        }
        if (data.dateRange?.end instanceof Timestamp) {
          endDisplay = data.dateRange.end.toDate().toLocaleDateString();
        }

        // b) paidAt
        const paidAtDisplay = data.paidAt instanceof Timestamp
          ? data.paidAt.toDate().toLocaleString()
          : '—';

        // c) numberOfReports
        const count = typeof data.numberOfReports === 'number'
          ? data.numberOfReports
          : 0;

        tempRows.push({
          historyId: histId,
          dateRange: `${startDisplay} – ${endDisplay}`,
          paidAt: paidAtDisplay,
          numberOfReports: count,
          rawAssociateIds: Array.isArray(data.associateIds) ? data.associateIds : []
        });

        // Prepare an “allDetails[historyId]” array for download if user clicks Download.
        // We’ll simply store the rawAssociateIds and that history’s doc reference,
        // so the “detail” page can fetch individual reports if desired. 
        allDetails[histId] = {
          associateIds: Array.isArray(data.associateIds) ? data.associateIds : [],
          dateRangeTimestamps: data.dateRange ?? null
        };
      }

      setRows(tempRows);
      detailRef.current = allDetails;
      setLoading(false);
    })();
  }, [loading, profile]);

  // Early‐return: while loading
  if (loading) {
    return <p className="p-6">Loading profile…</p>;
  }
  // If not an associate, redirect away
  if (!profile || profile.role !== 'associate') {
    return <Navigate to="/" replace />;
  }
  // While data is loading
  if (loadingData) {
    return <p className="p-6">Loading payment history…</p>;
  }

  // ——————————————————————————————————————————————
  // Helper: Download a single payment‐history’s reports as Excel
  // ——————————————————————————————————————————————
  const handleDownloadOne = async (historyId) => {
    const info = detailRef.current[historyId];
    if (!info) {
      alert('No detail found.');
      return;
    }
    const assocIds = info.associateIds;
    if (!assocIds.length) {
      alert('No associates recorded in this history.');
      return;
    }

    // Determine dateRange timestamps from stored history
    let startTs = null, endTs = null;
    if (info.dateRangeTimestamps?.start instanceof Timestamp &&
        info.dateRangeTimestamps?.end   instanceof Timestamp) {
      startTs = info.dateRangeTimestamps.start;
      endTs   = info.dateRangeTimestamps.end;
    }
    // If for some reason dateRange was missing, you could prompt the user or skip
    if (!startTs || !endTs) {
      alert('Cannot determine date range for download.');
      return;
    }

    // Chunk the associateIds by 10 to respect Firestore “in” limit
    const chunks = [];
    for (let i = 0; i < assocIds.length; i += 10) {
      chunks.push(assocIds.slice(i, i + 10));
    }

    // 1) Gather all matching “reports” for those associate CIDs in [startTs, endTs]
    const allRows = [];
    for (let chunk of chunks) {
      const rQuery = query(
        collection(db, 'reports'),
        where('companyId', 'in', chunk),
        where('createdAt', '>=', startTs),
        where('createdAt', '<=', endTs)
      );
      const rSnap = await getDocs(rQuery);
      rSnap.docs.forEach(rDoc => {
        const r = rDoc.data();
        allRows.push({
          'Report ID':        rDoc.id,
          'Associate CID':    r.companyId || '',
          'Student Name':     r.studentName || '',
          'Course':           r.course || '',
          'Status':           r.status || '',
          'Created At':       r.createdAt instanceof Timestamp
                                ? r.createdAt.toDate().toLocaleString()
                                : ''
        });
      });
    }

    if (!allRows.length) {
      alert('No reports found in that date range.');
      return;
    }

    // 2) Build & download Excel
    const ws = XLSX.utils.json_to_sheet(allRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reports');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(
      new Blob([wbout], { type: 'application/octet-stream' }),
      `associateHistory_${historyId}_reports.xlsx`
    );
  };

  // ——————————————————————————————————————————————
  // Render the payment‐history table
  // ——————————————————————————————————————————————
  return (
    <div className="p-6 max-w-4xl mx-auto">
        <br /><br />
      
      <h2 className="text-2xl font-bold mb-4">My Payment History</h2>

      <div className="overflow-x-auto bg-white shadow rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              {['#', 'Date Range', 'Paid At', '# Reports', 'Actions'].map(col => (
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
            {rows.length > 0 ? (
              rows.map((r, idx) => (
                <tr
                  key={r.historyId}
                  className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                >
                  <td className="px-4 py-2">{idx + 1}</td>
                  <td className="px-4 py-2">{r.dateRange}</td>
                  <td className="px-4 py-2">{r.paidAt}</td>
                  <td className="px-4 py-2">{r.numberOfReports}</td>
                  <td className="px-4 py-2 space-x-2">
                    <button
                      onClick={() =>
                        navigate(`/associate/payment-history/${r.historyId}`, {
                          state: {
                            // Pass the raw Timestamp range so detail page can fall back if needed
                            range: detailRef.current[r.historyId]?.dateRangeTimestamps
                          }
                        })
                      }
                      className="px-2 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600 text-sm"
                    >
                      Expand
                    </button>
                    <button
                      onClick={() => handleDownloadOne(r.historyId)}
                      className="px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                    >
                      Download
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-center text-gray-500">
                  No payment history found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
        <Waves
  lineColor="#e3f5f8"
  backgroundColor="rgba(255, 255, 255, 0.2)"
  waveSpeedX={0.02}
  waveSpeedY={0.01}
  waveAmpX={40}
  waveAmpY={20}
  friction={0.9}
  tension={0.01}
  maxCursorMove={120}
  xGap={12}
  yGap={36}
/>
    </div>
  );
}
