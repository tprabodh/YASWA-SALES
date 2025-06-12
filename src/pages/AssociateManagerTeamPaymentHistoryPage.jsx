// src/pages/AssociateManagerTeamPaymentHistoryPage.jsx

import React, { useEffect, useState, useRef } from 'react';
import { Navigate, useNavigate }            from 'react-router-dom';
import { useUserProfile }                   from '../hooks/useUserProfile';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db }                               from '../firebase';
import * as XLSX                            from 'xlsx';
import { saveAs }                           from 'file-saver';

export default function AssociateManagerTeamPaymentHistoryPage() {
  const { profile, loading } = useUserProfile();
  const navigate             = useNavigate();

  const [rows, setRows]           = useState([]);
  const [loadingData, setLoading] = useState(true);

  // We’ll store each history doc’s raw data here so that “Download” can export only that history’s reports.
  const detailRef = useRef({});

  useEffect(() => {
    // 1) Wait until the user profile has finished loading
    if (loading) return;

    // 2) Only an associateManager may see this page
    if (!profile || profile.role !== 'associateManager') {
      return;
    }

    (async () => {
      setLoading(true);

      // 3) “associateManagerCompanyId” must match our user’s companyId
      const myManagerCid = profile.companyId;
      if (!myManagerCid) {
        setRows([]);
        setLoading(false);
        return;
      }

      const histCol = collection(db, 'associatePaymentHistory');
      const q = query(
        histCol,
        where('associateManagerCompanyId', '==', myManagerCid)
      );
      const snap = await getDocs(q);

      const tempRows = [];
      const allDetails = {};

      snap.docs.forEach(docSnap => {
        const data = docSnap.data();
        const histId = docSnap.id;

        // a) Format “dateRange” for display
        let startDisp = '—', endDisp = '—';
        if (data.dateRange?.start instanceof Timestamp) {
          startDisp = data.dateRange.start.toDate().toLocaleDateString();
        }
        if (data.dateRange?.end instanceof Timestamp) {
          endDisp = data.dateRange.end.toDate().toLocaleDateString();
        }

        // b) Format “paidAt”
        let paidAtDisp = '—';
        if (data.paidAt instanceof Timestamp) {
          paidAtDisp = data.paidAt.toDate().toLocaleString();
        }

        // c) Number of reports (fallback to 0 if missing)
        const numReports = typeof data.numberOfReports === 'number'
          ? data.numberOfReports
          : 0;

        tempRows.push({
          historyId:       histId,
          dateRange:       `${startDisp} – ${endDisp}`,
          paidAt:          paidAtDisp,
          numberOfReports: numReports,
          associateIds:    Array.isArray(data.associateIds) ? data.associateIds : [],
          dateRangeTS:     data.dateRange   // store the actual Timestamps for breakup/download
        });

        // Store the raw fields so that “Download” knows which associates + what range to pull
        allDetails[histId] = {
          associateIds:    Array.isArray(data.associateIds) ? data.associateIds : [],
          dateRangeTimestamps: data.dateRange
        };
      });

      setRows(tempRows);
      detailRef.current = allDetails;
      setLoading(false);
    })();
  }, [loading, profile]);

  // ——————————————————————————————
  // Early‐return while the profile is still loading
  if (loading) {
    return <p className="p-6">Loading profile…</p>;
  }

  // Only associateManager may stay here; otherwise redirect
  if (!profile || profile.role !== 'associateManager') {
    return <Navigate to="/" replace />;
  }

  // While we’re fetching the history entries
  if (loadingData) {
    return <p className="p-6">Loading payment‐history…</p>;
  }

  // ——————————————————————————————
  // Helper: download all reports covered by a single history doc
  // ——————————————————————————————
  const handleDownloadOne = async (historyId) => {
    const info = detailRef.current[historyId];
    if (!info) {
      alert('No detail found.');
      return;
    }

    const { associateIds, dateRangeTimestamps } = info;
    if (!associateIds.length) {
      alert('No associates recorded in this history.');
      return;
    }

    // Extract start/end Timestamps
    const startTs = dateRangeTimestamps?.start;
    const endTs   = dateRangeTimestamps?.end;
    if (!(startTs instanceof Timestamp) || !(endTs instanceof Timestamp)) {
      alert('Cannot determine date range to download.');
      return;
    }

    // Firestore “in” can only take up to 10 values, so chunk if necessary:
    const chunks = [];
    for (let i = 0; i < associateIds.length; i += 10) {
      chunks.push(associateIds.slice(i, i + 10));
    }

    // Accumulate all matching report‐docs in [startTs, endTs] whose fields:
    //    associatePayment === 'paid' && associateManagerPayment === 'paid'
    // (Because this page’s “team payment” implies both have been marked “paid”.)
    const allRows = [];
    for (let chunk of chunks) {
      const rQ = query(
        collection(db, 'reports'),
        where('companyId', 'in', chunk),
        where('createdAt', '>=', startTs),
        where('createdAt', '<=', endTs),
        where('associatePayment', '==', 'paid'),
        where('associateManagerPayment', '==', 'paid')
      );
      const rSnap = await getDocs(rQ);

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
      alert('No paid‐reports found in that date range.');
      return;
    }

    // Build & download Excel file
    const ws   = XLSX.utils.json_to_sheet(allRows);
    const wb   = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reports');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(
      new Blob([wbout], { type: 'application/octet-stream' }),
      `teamHistory_${historyId}_reports.xlsx`
    );
  };

  // ——————————————————————————————
  // Render
  // ——————————————————————————————
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Team’s Payment History</h2>

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
                        navigate(
                          `/associate-manager/team-breakup/${r.historyId}`,
                          {
                            state: {
                              associateIds: r.associateIds,
                              dateRangeTimestamps: r.dateRangeTS
                            }
                          }
                        )
                      }
                      className="px-2 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600 text-sm"
                    >
                      View Breakup
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
    </div>
  );
}
