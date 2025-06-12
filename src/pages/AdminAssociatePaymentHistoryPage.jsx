// src/pages/AdminAssociatePaymentHistoryPage.jsx

import React, { useEffect, useState } from 'react';
import { Navigate }       from 'react-router-dom';
import { useUserProfile } from '../hooks/useUserProfile';
import {
  collection,
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

export default function AdminAssociatePaymentHistoryPage() {
  const { profile, loading: authLoading } = useUserProfile();
  const [loading, setLoading]           = useState(true);
  const [historyRows, setHistoryRows]   = useState([]);
  const [expanded, setExpanded]         = useState({}); // track which rows are expanded

  // 1) Fetch “associatePaymentHistory” once we know the user is an admin:
  useEffect(() => {
    if (authLoading) return;
    if (!profile || profile.role !== 'admin') return;

    (async () => {
      setLoading(true);

      const snap = await getDocs(collection(db, 'associatePaymentHistory'));
      const rows = snap.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id:                 docSnap.id,
          dateRangeStart:     data.dateRange?.start?.toDate() || null,
          dateRangeEnd:       data.dateRange?.end?.toDate() || null,
          paidAt:             data.paidAt?.toDate() || null,
          managerCompanyId:   data.associateManagerCompanyId || '—',
          associateIds:       Array.isArray(data.associateIds) ? data.associateIds : []
        };
      });

      // Sort by paidAt descending (newest first)
      rows.sort((a, b) => {
        if (!a.paidAt || !b.paidAt) return 0;
        return b.paidAt.getTime() - a.paidAt.getTime();
      });

      setHistoryRows(rows);
      setLoading(false);
    })();
  }, [authLoading, profile]);

  // 2) Early‐return while checking profile or loading data:
  if (authLoading) {
    return <p className="p-6">Loading profile…</p>;
  }
  if (!profile || profile.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  if (loading) {
    return <p className="p-6">Loading payment history…</p>;
  }

  // 3) Toggle “expand” for a row:
  const toggleExpand = (rowId) => {
    setExpanded(prev => ({
      ...prev,
      [rowId]: !prev[rowId]
    }));
  };

  // 4) Download just this row’s associate IDs:
  const handleDownloadRow = (row) => {
    if (!row.associateIds?.length) {
      alert('No associates recorded for this entry.');
      return;
    }

    // Build a simple sheet of associate IDs
    const sheetData = row.associateIds.map((cid) => ({
      'Associate Company ID': cid
    }));

    // Create a worksheet & workbook
    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Associates');

    // Build a filename that includes the managerCompanyId and date range
    const startISO = row.dateRangeStart
      ? row.dateRangeStart.toISOString().slice(0, 10)
      : 'unknown';
    const endISO = row.dateRangeEnd
      ? row.dateRangeEnd.toISOString().slice(0, 10)
      : 'unknown';
    const filename = `AssocMgr_${row.managerCompanyId}_PaymentHistory_${startISO}_to_${endISO}.xlsx`;

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), filename);
  };

  // 5) Render the table with S.no, Date Range, Paid At, ManagerCID, Actions (Expand + Download):
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Associates’ Payment History</h2>

      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                S.no
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Date Range
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Paid At
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Associate Manager Company ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {historyRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                  No payment history found.
                </td>
              </tr>
            ) : (
              historyRows.map((row, idx) => (
                <React.Fragment key={row.id}>
                  <tr className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 text-sm text-gray-800">
                      {idx + 1}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-800">
                      {row.dateRangeStart && row.dateRangeEnd
                        ? `${row.dateRangeStart.toLocaleDateString()} – ${row.dateRangeEnd.toLocaleDateString()}`
                        : '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-800">
                      {row.paidAt
                        ? row.paidAt.toLocaleString()
                        : '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-800">
                      {row.managerCompanyId}
                    </td>
                    <td className="px-6 py-4 text-sm space-x-2">
                      <button
                        onClick={() => toggleExpand(row.id)}
                        className="px-2 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600 text-sm"
                      >
                        {expanded[row.id] ? 'Collapse' : 'Expand'}
                      </button>
                      <button
                        onClick={() => handleDownloadRow(row)}
                        className="px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                      >
                        Download
                      </button>
                    </td>
                  </tr>

                  {expanded[row.id] && (
                    <tr className="bg-gray-50">
                      <td colSpan={5} className="px-6 py-4 text-sm text-gray-700">
                        <strong>Associate IDs:</strong>{' '}
                        {row.associateIds.length > 0
                          ? row.associateIds.join(', ')
                          : 'None'}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
