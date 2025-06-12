// src/pages/AssociatePaymentHistoryDetailPage.jsx

import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useUserProfile }      from '../hooks/useUserProfile';
import {
  collection,
  doc,
  getDoc,
  query,
  where,
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { db }                  from '../firebase';

export default function AssociatePaymentHistoryDetailPage() {
  const { profile, loading } = useUserProfile();
  const { historyId }        = useParams();      // the ID of the associatePaymentHistory doc
  const location             = useLocation();
  const navigate             = useNavigate();

  const [historyDoc, setHistoryDoc]   = useState(null);
  const [reportRows, setReportRows]   = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!profile || profile.role !== 'associate') return;

    (async () => {
      setLoadingData(true);

      // 1) Fetch the paymentHistory document by ID
      const histRef = doc(db, 'associatePaymentHistory', historyId);
      const histSnap = await getDoc(histRef);
      if (!histSnap.exists()) {
        setHistoryDoc(null);
        setLoadingData(false);
        return;
      }
      const hData = histSnap.data();
      setHistoryDoc(hData);

      // 2) Extract associateIds and the dateRange:
      const aIds = Array.isArray(hData.associateIds) ? hData.associateIds : [];
      if (aIds.length === 0) {
        setReportRows([]);
        setLoadingData(false);
        return;
      }

      const startTs = hData.dateRange.start;
      const endTs   = hData.dateRange.end;

      if (!startTs || !endTs) {
        setReportRows([]);
        setLoadingData(false);
        return;
      }

      // 3) Query all reports with companyId in aIds AND createdAt in [start, end]
      // Firestore’s “in” only supports up to 10 items per query, so we chunk if needed.
      const chunks = [];
      for (let i = 0; i < aIds.length; i += 10) {
        chunks.push(aIds.slice(i, i + 10));
      }

      const allMatching = [];
      for (let chunk of chunks) {
        const rQuery = query(
          collection(db, 'reports'),
          where('companyId', 'in', chunk),
          where('createdAt', '>=', startTs),
          where('createdAt', '<=', endTs)
        );
        const rSnap = await getDocs(rQuery);
        rSnap.docs.forEach(d => {
          allMatching.push({ id: d.id, ...d.data() });
        });
      }

      setReportRows(allMatching);
      setLoadingData(false);
    })();
  }, [loading, profile, historyId]);

  // Redirect / guards
  if (loading) {
    return <p className="p-6">Loading profile…</p>;
  }
  if (!profile || profile.role !== 'associate') {
    return <Navigate to="/" replace />;
  }
  if (loadingData) {
    return <p className="p-6">Loading reports…</p>;
  }
  if (!historyDoc) {
    return (
      <div className="p-6">
        <p className="text-red-600">Payment history not found.</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Payment Details</h2>

      <div className="mb-4">
        <p>
          <strong>Date Range:</strong>{' '}
          {historyDoc.dateRange.start.toDate().toLocaleDateString()} –{' '}
          {historyDoc.dateRange.end.toDate().toLocaleDateString()}
        </p>
        <p>
          <strong>Paid At:</strong>{' '}
          {historyDoc.paidAt.toDate().toLocaleString()}
        </p>
        <p>
          <strong>Number of Reports Paid:</strong> {historyDoc.numberOfReports}
        </p>
      </div>

      <div className="overflow-x-auto bg-white shadow rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              {['#','Report ID','Student Name','Status','Created At'].map(col => (
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
            {reportRows.length > 0 ? (
              reportRows.map((r, idx) => (
                <tr
                  key={r.id}
                  className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                >
                  <td className="px-4 py-2">{idx + 1}</td>
                  <td className="px-4 py-2">{r.id}</td>
                  <td className="px-4 py-2">{r.studentName || '—'}</td>
                  <td className="px-4 py-2">{r.status || '—'}</td>
                  <td className="px-4 py-2">
                    {r.createdAt?.toDate().toLocaleString() || '—'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-center text-gray-500">
                  No matching reports in that period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <button
        onClick={() => navigate(-1)}
        className="mt-6 px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
      >
        Back to History
      </button>
    </div>
  );
}
