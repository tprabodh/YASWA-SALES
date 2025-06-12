// src/pages/AdminPaymentHistoryPage.jsx

import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useUserProfile } from '../hooks/useUserProfile';
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

export default function AdminPaymentHistoryPage() {
  const { profile, loading: authLoading } = useUserProfile();
  const [historyEntries, setHistoryEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  // 1) Load all paymentHistory documents if the current user is an admin
  useEffect(() => {
    if (authLoading) return;
    if (profile?.role !== 'admin') return;

    (async () => {
      setLoading(true);
      const snap = await getDocs(collection(db, 'paymentHistory'));
      const entries = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      // Sort newest first by “paidAt”
      entries.sort((a, b) => b.paidAt.toMillis() - a.paidAt.toMillis());
      setHistoryEntries(entries);
      setLoading(false);
    })();
  }, [authLoading, profile]);

  // 2) If still loading or not an admin, show loading or redirect
  if (authLoading || loading) {
    return <p className="p-6">Loading…</p>;
  }
  if (profile?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  // 3) Pretty‐print a Timestamp as “YYYY-MM-DD”
  const fmtDate = (ts) => {
    if (!ts || !(ts instanceof Timestamp)) return '';
    return ts.toDate().toLocaleDateString();
  };

  // 4) When the “Download” button is clicked for one paymentHistory entry:
  //    – Fetch only those reports (from “reports”) whose companyId is in entry.employeeIds,
  //      whose createdAt lies between the entry’s dateRange (inclusive), and whose
  //      paymentStatus, managerCommission, telecallerCommission, businessHeadCommission
  //      are all “paid.”
  //    – Then for each such report, look up its employee’s name & supervisorId (manager),
  //      the manager’s name, the telecaller that manages that manager, and the business head’s name.
  //    – Build a flat array of row objects, sheetify with xlsx, and trigger a download.
  const handleDownloadForEntry = async (entry) => {
    const { dateRange, employeeIds = [], managerIds = [], telecallerIds = [], businessHeadId } = entry;
    const startTS = dateRange?.start;
    const endTS   = dateRange?.end;
    if (!startTS || !endTS) {
      alert('Invalid date range.');
      return;
    }

    // 4a) First: gather all “fully‐paid” reports in that date range for those employees.
    // Firestore “in” clauses must be ≤ 10, so we chunk employeeIds into groups of max 10.
    const chunkSize = 10;
    const allReportDocs = [];

    for (let i = 0; i < employeeIds.length; i += chunkSize) {
      const chunk = employeeIds.slice(i, i + chunkSize);
      const rptQuery = query(
        collection(db, 'reports'),
        where('companyId', 'in', chunk),
        where('createdAt', '>=', startTS),
        where('createdAt', '<=', endTS),
        where('paymentStatus', '==', 'paid'),
        where('managerCommission', '==', 'paid'),
        where('telecallerCommission', '==', 'paid'),
        where('businessHeadCommission', '==', 'paid')
      );
      const rptSnap = await getDocs(rptQuery);
      rptSnap.docs.forEach(d => allReportDocs.push(d));
    }

    // If no matching reports, we’ll simply end up with an empty Excel sheet.
    // (Optional: You could `alert('No fully‐paid reports found.')`.)

    // 4b) Build a list of unique employee CIDs from those report documents:
    const uniqueEmployeeCids = Array.from(
      new Set(allReportDocs.map(docRef => docRef.data().companyId))
    );

    // 4c) Fetch each employee’s user document (to get name + supervisorId)
    const employeeMap = {}; // empCID → { name, supervisorId }
    if (uniqueEmployeeCids.length > 0) {
      for (let i = 0; i < uniqueEmployeeCids.length; i += chunkSize) {
        const chunk = uniqueEmployeeCids.slice(i, i + chunkSize);
        const uQuery = query(
          collection(db, 'users'),
          where('companyId', 'in', chunk)
        );
        const uSnap = await getDocs(uQuery);
        uSnap.docs.forEach(d => {
          const data = d.data();
          employeeMap[data.companyId] = {
            name: data.name,
            supervisorId: data.supervisorId || null
          };
        });
      }
    }

    // 4d) Gather the unique set of managerCIDs from employeeMap:
    const uniqueManagerCids = Array.from(
      new Set(
        Object.values(employeeMap)
          .map(e => e.supervisorId)
          .filter(Boolean)
      )
    );

    // 4e) Fetch each manager user doc to get its name
    const managerMap = {}; // mgrCID → { name }
    if (uniqueManagerCids.length > 0) {
      for (let i = 0; i < uniqueManagerCids.length; i += chunkSize) {
        const chunk = uniqueManagerCids.slice(i, i + chunkSize);
        const mQuery = query(
          collection(db, 'users'),
          where('companyId', 'in', chunk)
        );
        const mSnap = await getDocs(mQuery);
        mSnap.docs.forEach(d => {
          const data = d.data();
          managerMap[data.companyId] = { name: data.name };
        });
      }
    }

    // 4f) Fetch all telecallers listed in entry.telecallerIds to get their names
    const telecallerMap = {}; // teleCID → { name }
    if ((telecallerIds || []).length > 0) {
      for (let i = 0; i < telecallerIds.length; i += chunkSize) {
        const chunk = telecallerIds.slice(i, i + chunkSize);
        const tQuery = query(
          collection(db, 'users'),
          where('companyId', 'in', chunk)
        );
        const tSnap = await getDocs(tQuery);
        tSnap.docs.forEach(d => {
          const data = d.data();
          telecallerMap[data.companyId] = { name: data.name };
        });
      }
    }

    // 4g) Fetch the single business head (entry.businessHeadId), to get its name
    const businessHeadMap = {}; // bhCID → { name }
    if (businessHeadId) {
      const bhQuery = query(
        collection(db, 'users'),
        where('companyId', '==', businessHeadId)
      );
      const bhSnap = await getDocs(bhQuery);
      if (!bhSnap.empty) {
        const data = bhSnap.docs[0].data();
        businessHeadMap[data.companyId] = { name: data.name };
      }
    }

    // 4h) Now build the actual array of row‐objects. Because we need `await` when trying to
    //      find which telecaller “manages” each manager, we CANNOT use .map(…) with a synchronous
    //      callback. Instead, we do a for…of and `await` explicitly inside:
    const rowsForExcel = [];

    for (const docRef of allReportDocs) {
      const rpt = docRef.data();
      const empCid = rpt.companyId;
      const empName = (employeeMap[empCid] || {}).name || '—';
      const mgrCid = (employeeMap[empCid] || {}).supervisorId || '';
      const mgrName = (managerMap[mgrCid] || {}).name || '—';

      // 4h.i) Find WHICH telecaller ∈ entry.telecallerIds has “managing.includes(mgrCid)”.
      //        We re‐query each telecaller’s document to check its `.managing` array.
      let teleCid = '';
      let teleName = '—';

      for (const tCid of (telecallerIds || [])) {
        // Re‐query user for this tCid (to get its `managing` array)
        const tSnap = await getDocs(
          query(collection(db, 'users'), where('companyId', '==', tCid))
        );
        if (!tSnap.empty) {
          const tData = tSnap.docs[0].data();
          if ((tData.managing || []).includes(mgrCid)) {
            teleCid = tCid;
            teleName = tData.name;
            break;
          }
        }
      }

      // 4h.ii) Business Head’s ID & name
      const bhCid = businessHeadId || '';
      const bhName = (businessHeadMap[bhCid] || {}).name || '—';

      rowsForExcel.push({
        reportId:             docRef.id,
        studentName:          rpt.studentName || '—',
        grade:                rpt.grade || '—',
        course:               rpt.course || '—',
        status:               rpt.status || '—',
        createdAt:            rpt.createdAt.toDate().toLocaleString(),
        employeeCompanyId:    empCid,
        employeeName:         empName,
        managerCompanyId:     mgrCid,
        managerName:          mgrName,
        telecallerCompanyId:  teleCid,
        telecallerName:       teleName,
        businessHeadCompanyId: bhCid,
        businessHeadName:     bhName
      });
    }

    // 4i) Finally, convert that array to a sheet and trigger a download
    const ws = XLSX.utils.json_to_sheet(rowsForExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Fully Paid Reports');
    const fileName = `PaymentHistory_${entry.id}_reports.xlsx`;
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), fileName);
  };

  // 5) Render the table of paymentHistory entries
  return (
    <div className="p-6 min-h-screen bg-gray-50">
      <h2 className="text-2xl font-bold mb-4">Payment History</h2>

      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              {['#', 'Date Range', 'Paid At', 'Business Head ID', 'Actions'].map(hdr => (
                <th
                  key={hdr}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide"
                >
                  {hdr}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {historyEntries.length > 0 ? (
              historyEntries.map((entry, idx) => {
                const startDate = fmtDate(entry.dateRange.start);
                const endDate   = fmtDate(entry.dateRange.end);
                const paidAtStr = entry.paidAt.toDate().toLocaleString();
                const bhId      = entry.businessHeadId || '—';
                const isExpanded = expandedId === entry.id;

                return (
                  <React.Fragment key={entry.id}>
                    <tr className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 text-sm text-gray-900">{idx + 1}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {startDate} – {endDate}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{paidAtStr}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{bhId}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 space-x-2">
                        <button
                          onClick={() =>
                            setExpandedId(isExpanded ? null : entry.id)
                          }
                          className="px-3 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600 text-xs"
                        >
                          {isExpanded ? 'Hide Details' : 'View Details'}
                        </button>
                        <button
                          onClick={() => handleDownloadForEntry(entry)}
                          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                        >
                          Download
                        </button>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-gray-50">
                        <td colSpan={5} className="px-6 py-4 text-sm text-gray-700">
                          <div className="mb-2">
                            <strong>Telecaller IDs:</strong>{' '}
                            {entry.telecallerIds && entry.telecallerIds.length > 0
                              ? entry.telecallerIds.join(', ')
                              : '—'}
                          </div>
                          <div className="mb-2">
                            <strong>Manager IDs:</strong>{' '}
                            {entry.managerIds && entry.managerIds.length > 0
                              ? entry.managerIds.join(', ')
                              : '—'}
                          </div>
                          <div>
                            <strong>Employee IDs:</strong>{' '}
                            {entry.employeeIds && entry.employeeIds.length > 0
                              ? entry.employeeIds.join(', ')
                              : '—'}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                  No payment history entries found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
