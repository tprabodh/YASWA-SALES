// src/pages/PaymentHistoryPage.jsx

import React, { useEffect, useState } from 'react';
import { toast, ToastContainer }     from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useUserProfile }            from '../hooks/useUserProfile';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { db }                        from '../firebase';
import DateRangePicker               from '../Components/DateRangePicker';
import * as XLSX                     from 'xlsx';
import { saveAs }                    from 'file-saver';
import { Navigate }                  from 'react-router-dom';

function getDateRange(type, custom) {
  const now = new Date();
  let start, end;

  if (type === 'today') {
    start = new Date(now); start.setHours(0, 0, 0, 0);
    end   = new Date(now); end.setHours(23, 59, 59, 999);
  } else if (type === 'yesterday') {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    start = new Date(d); start.setHours(0, 0, 0, 0);
    end   = new Date(d); end.setHours(23, 59, 59, 999);
  } else if (type === 'thisWeek') {
    const day = now.getDay(),
          diff = (day + 6) % 7;
    start = new Date(now);
    start.setDate(now.getDate() - diff);
    start.setHours(0, 0, 0, 0);
    end   = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else if (type === 'thisMonth') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (type === 'custom' && custom.start && custom.end) {
    start = custom.start;
    end   = custom.end;
  } else {
    // fallback to today
    start = new Date(now); start.setHours(0, 0, 0, 0);
    end   = new Date(now); end.setHours(23, 59, 59, 999);
  }

  return { start, end };
}

export default function PaymentHistoryPage() {
  const { profile, loading } = useUserProfile();
  const [historyEntries, setHistoryEntries] = useState([]);
  const [dateType, setDateType]            = useState('today');
  const [customRange, setCustomRange]      = useState({ start: null, end: null });
  const [loadingData, setLoadingData]      = useState(true);

  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;

    // Only these roles may view payment history
    const allowedRoles = ['employee', 'associate', 'businessDevelopmentConsultant'];
    if (!profile || !allowedRoles.includes(profile.role)) {
      setLoadingData(false);
      return;
    }

    (async () => {
      setLoadingData(true);

      // 1) Fetch all runs where my companyId is in subordinateIds
      const histSnap = await getDocs(
        query(
          collection(db, 'paymentHistory'),
          where('subordinateIds', 'array-contains', profile.companyId)
        )
      );
      const rawHistory = histSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const computed   = [];

      // 2) For each run, re‐count exactly how many of this user’s reports 
      //    (companyId === my ID) in that run’s [start..end] have paymentStatus & managerCommission both "paid"
      for (let entry of rawHistory) {
        const startDate = entry.dateRange.start.toDate();
        const endDate   = entry.dateRange.end.toDate();
        const tsStart   = Timestamp.fromDate(startDate);
        const tsEnd     = Timestamp.fromDate(endDate);

        const snaps = await getDocs(
          query(
            collection(db, 'reports'),
            where('companyId', '==', profile.companyId),
            where('createdAt', '>=', tsStart),
            where('createdAt', '<=', tsEnd),
            where('paymentStatus', '==', 'paid'),
            where('managerCommission', '==', 'paid')
          )
        );
        const paidReports = snaps.docs.map(d => ({ id: d.id, ...d.data() }));

        computed.push({
          id: entry.id,
          dateRange: entry.dateRange,
          paidAt: entry.paidAt,
          numberOfReports: paidReports.length,
          paidReportIds: paidReports.map(r => r.id)
        });
      }

      // 3) Sort by paidAt descending
      computed.sort((a, b) => b.paidAt.toMillis() - a.paidAt.toMillis());

      setHistoryEntries(computed);
      setLoadingData(false);
    })();
  }, [loading, profile, dateType, customRange]);


  // ─────────────────────────────────────────────────────────
  // Redirect if not allowed role
  if (!loading) {
    const allowedRoles = ['employee', 'associate', 'businessDevelopmentConsultant'];
    if (!profile || !allowedRoles.includes(profile.role)) {
      return <Navigate to="/YASWA-SALES/" replace />;
    }
  }

  // Show spinner until both auth and data finish loading
  if (loading || loadingData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-600">Loading…</p>
      </div>
    );
  }

  // Build a filename base for Excel download
  const buildFilenameBase = (range) => {
    const toIso = d => d.toISOString().slice(0, 10);
    const s = toIso(range.start.toDate()), e = toIso(range.end.toDate());
    return profile.companyId + '_' + (s === e ? s : `${s}_to_${e}`);
  };

  // Download handler
  const handleDownloadReports = async (entry) => {
    const rows = [];
    for (let rid of entry.paidReportIds) {
      const docSnap = await getDocs(
        query(collection(db, 'reports'), where('__name__', '==', rid))
      );
      if (!docSnap.empty) {
        const r = docSnap.docs[0].data();
        rows.push({
          'Report ID':    rid,
          'Student Name': r.studentName || '',
          Grade:          r.grade || '',
          Course:         r.course || '',
          Status:         r.status || '',
          'Created At':   r.createdAt?.toDate().toLocaleString() || '',
          'Paid At':      entry.paidAt.toDate().toLocaleString(),
        });
      }
    }
    if (!rows.length) {
      return toast.info('No paid reports found.');
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'My Paid Reports');
    XLSX.writeFile(wb, `${buildFilenameBase(entry.dateRange)}_my_reports.xlsx`);
  };


  // ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 p-6">
        <br /><br />
      <ToastContainer
        position="top-center"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />

<h2 className="text-2xl font-bold mb-4">
  {profile.name} ({profile.companyId})'s Payment History
</h2>
      {/* Date‐range selector */}
      <div className="mb-4 max-w-md">
        <DateRangePicker
          value={dateType}
          onChangeType={setDateType}
          customRange={customRange}
          onChangeCustom={delta =>
            setCustomRange(cr => ({ ...cr, ...delta }))
          }
        />
      </div>

      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              {['Paid Date/Period','Paid On','Total Reports','Actions'].map(h => (
                <th
                  key={h}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {historyEntries.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-6 py-4 text-center text-gray-500"
                >
                  No payment history found.
                </td>
              </tr>
            ) : (
              historyEntries.map((entry, idx) => {
                const s = entry.dateRange.start.toDate();
                const e = entry.dateRange.end.toDate();
                return (
                  <tr key={entry.id} className={idx % 2 ? 'bg-gray-50' : ''}>
                    <td className="px-6 py-3 text-sm text-gray-800">
                      {s.toLocaleDateString()} – {e.toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-800">
                      {entry.paidAt.toDate().toLocaleString()}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-800">
                      {entry.numberOfReports}
                    </td>
                    <td className="px-6 py-3 text-sm">
                      <button
                        onClick={() => handleDownloadReports(entry)}
                        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                      >
                        Download Reports
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
