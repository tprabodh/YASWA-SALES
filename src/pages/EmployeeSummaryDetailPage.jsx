// src/pages/EmployeeSummaryDetailPage.jsx

import React, { useEffect, useState } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
  addDoc,
  updateDoc,
  doc,
} from 'firebase/firestore';
import { db } from '../firebase';
import * as XLSX from 'xlsx';
import DateRangePicker from '../Components/DateRangePicker';

function getDateRange(type, custom) {
  const now = new Date();
  let start, end;

  if (type === 'today') {
    start = new Date(now);
    start.setHours(0, 0, 0, 0);
    end = new Date(now);
    end.setHours(23, 59, 59, 999);
  } else if (type === 'yesterday') {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    start = new Date(d);
    start.setHours(0, 0, 0, 0);
    end = new Date(d);
    end.setHours(23, 59, 59, 999);
  } else if (type === 'thisWeek') {
    const day = now.getDay(),
      diff = (day + 6) % 7;
    start = new Date(now);
    start.setDate(now.getDate() - diff);
    start.setHours(0, 0, 0, 0);

    end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else if (type === 'thisMonth') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (type === 'custom' && custom.start && custom.end) {
    start = custom.start;
    end = custom.end;
  } else {
    // fallback to today
    start = new Date(now);
    start.setHours(0, 0, 0, 0);
    end = new Date(now);
    end.setHours(23, 59, 59, 999);
  }

  return { start, end };
}

export default function EmployeeSummaryDetailPage({ hideActions = false }) {
  const { state } = useLocation();
  const mgr = state?.manager;
  const navigate = useNavigate();

  // Redirect if we landed here without a manager object
  useEffect(() => {
    if (!mgr) {
      navigate('/admin/employee-summary', { replace: true });
    }
  }, [mgr, navigate]);

  const [subs, setSubs] = useState([]);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('current');
  const [dateType, setDateType] = useState('today');
  const [customRange, setCustomRange] = useState({ start: null, end: null });
  const [loading, setLoading] = useState(true);

  // Always compute current [start,end] from DateRangePicker
  const { start, end } = getDateRange(dateType, customRange);
  const bStart = Timestamp.fromDate(start);
  const bEnd = Timestamp.fromDate(end);

  useEffect(() => {
    if (!mgr) return;
    setLoading(true);

    (async () => {
      if (activeTab === 'current') {
        // ───────── CURRENT TAB ───────────────────────────────────────────
        // 1) Fetch manager's direct subordinates (employees) from Firestore
        const usSnap = await getDocs(
          query(
            collection(db, 'users'),
            where('supervisorId', '==', mgr.companyId)
          )
        );

        // Build “team” = [manager + all direct subordinates]
        const team = [
          { uid: mgr.uid, name: mgr.name, companyId: mgr.companyId },
          ...usSnap.docs.map((d) => ({ uid: d.id, ...d.data() })),
        ];

        // 2) For each team member, count total/approved/pending/rejected in the date window
        const enriched = await Promise.all(
          team.map(async (u) => {
            const snaps = await getDocs(
              query(
                collection(db, 'reports'),
                where('userId', '==', u.uid),
                where('createdAt', '>=', bStart),
                where('createdAt', '<=', bEnd)
              )
            );
            let total = 0,
              approved = 0,
              pending = 0,
              rejected = 0;
            snaps.docs.forEach((d) => {
              total++;
              const s = d.data().status?.toLowerCase();
              if (s === 'approved') approved++;
              else if (s === 'pending') pending++;
              else if (s === 'rejected') rejected++;
            });
            return { ...u, total, approved, pending, rejected };
          })
        );
        enriched.sort((a, b) => a.name.localeCompare(b.name));
        setSubs(enriched);

      } else {
        // ───────── HISTORY TAB ────────────────────────────────────────────
        // 1) Query paymentHistory where this manager’s companyId is in “managerIds”
        const historySnap = await getDocs(
          query(
            collection(db, 'paymentHistory'),
            where('managerIds', 'array-contains', mgr.companyId)
          )
        );
        const rawHistory = historySnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        // 2) Fetch THIS manager’s Firestore doc (so we can read his “subordinates”, “associates”, “businessDevelopmentConsultants”)
        const mgrDocSnap = await getDocs(
          query(collection(db, 'users'), where('companyId', '==', mgr.companyId))
        );
        const mgrData = mgrDocSnap.docs[0]?.data() || {};

        const employeeCIDs = Array.isArray(mgrData.subordinates)
          ? mgrData.subordinates
          : [];
        const associateCIDs = Array.isArray(mgrData.associates)
          ? mgrData.associates
          : [];
        const bdcCIDs = Array.isArray(mgrData.businessDevelopmentConsultants)
          ? mgrData.businessDevelopmentConsultants
          : [];

        // 3) Merge all underlings’ companyIds into one array (deduped)
        const allUnderCIDs = Array.from(
          new Set([...employeeCIDs, ...associateCIDs, ...bdcCIDs])
        );

        // 4) For each payment‐run, re‐count exactly how many “reports” in that date window
        //    have both paymentStatus==="paid" and managerCommission==="paid", AND whose
        //    report.companyId belongs to allUnderCIDs
        const computedHistory = await Promise.all(
          rawHistory.map(async (entry) => {
            const startDate = entry.dateRange.start.toDate();
            const endDate = entry.dateRange.end.toDate();

            // Because Firestore “in” can only take ≤10 elements, we chunk:
            const paidReports = [];
            for (let i = 0; i < allUnderCIDs.length; i += 10) {
              const chunk = allUnderCIDs.slice(i, i + 10);
              const snaps = await getDocs(
                query(
                  collection(db, 'reports'),
                  where('companyId', 'in', chunk),
                  where('createdAt', '>=', Timestamp.fromDate(startDate)),
                  where('createdAt', '<=', Timestamp.fromDate(endDate)),
                  where('paymentStatus', '==', 'paid'),
                  where('managerCommission', '==', 'paid')
                )
              );
              snaps.docs.forEach((d) => {
                paidReports.push({ id: d.id, ...d.data() });
              });
            }

            // Deduplicate the companyIds of those paid reports
            const paidCIDs = Array.from(
              new Set(paidReports.map((r) => r.companyId))
            );

            return {
              id: entry.id,
              dateRange: entry.dateRange,
              paidAt: entry.paidAt,
              paidCompanyIds: paidCIDs,
              numberOfReports: paidReports.length,
            };
          })
        );

        setHistory(computedHistory);
      }
      setLoading(false);
    })();
  }, [mgr, activeTab, dateType, customRange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-600">Loading…</p>
      </div>
    );
  }

  // Helper to build a filename base from a dateRange
  const filenameBase = () => {
    const fmt = (d) => d.toISOString().slice(0, 10);
    const a = fmt(start),
      b = fmt(end);
    return mgr.companyId + '_' + (a === b ? a : `${a}_to_${b}`);
  };

  // Officer‐level Download (exactly as before)
  const handleEmpDownload = async () => {
    const rows = [];
    const team = [mgr, ...subs.filter((u) => u.uid !== mgr.uid)];
    for (let u of team) {
      const snaps = await getDocs(
        query(
          collection(db, 'reports'),
          where('userId', '==', u.uid),
          where('createdAt', '>=', bStart),
          where('createdAt', '<=', bEnd)
        )
      );
      snaps.docs.forEach((d) => {
        const r = d.data();
        rows.push({
          'Officer ID': u.companyId,
          Name: u.name,
          Student: r.studentName,
          Grade: r.grade,
          Course: r.course,
          Status: r.status,
          'Created At': r.createdAt.toDate().toLocaleString(),
          Commission: 2000,
        });
      });
    }
    if (!rows.length) {
      return alert('No reports in range.');
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Officer Reports');
    XLSX.writeFile(wb, `${filenameBase()}_officer.xlsx`);
  };

  // Manager‐level Download (exactly as before)
  const handleMgrDownload = async () => {
    let rows = [];
    for (let u of subs.filter((u) => u.uid !== mgr.uid)) {
      const snaps = await getDocs(
        query(
          collection(db, 'reports'),
          where('userId', '==', u.uid),
          where('createdAt', '>=', bStart),
          where('createdAt', '<=', bEnd)
        )
      );
      snaps.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((r) => r.status?.toLowerCase() === 'approved')
        .forEach((r) => {
          rows.push({
            'Officer ID': u.companyId,
            'Officer Name': u.name,
            Student: r.studentName,
            Grade: r.grade,
            Course: r.course,
            Status: r.status,
            'Created At': r.createdAt.toDate().toLocaleString(),
            'Manager Commission': 500,
          });
        });
    }
    if (!rows.length) {
      return alert('No approved reports to download.');
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Manager Payouts');
    XLSX.writeFile(wb, `${filenameBase()}_manager.xlsx`);
  };

  // Approve All (unchanged)
  const handleApproveAll = async () => {
    // Gather all reports in window for manager + subordinates
    const team = [mgr, ...subs.filter((u) => u.uid !== mgr.uid)];
    let allReports = [];
    for (let u of team) {
      const snaps = await getDocs(
        query(
          collection(db, 'reports'),
          where('userId', '==', u.uid),
          where('createdAt', '>=', bStart),
          where('createdAt', '<=', bEnd)
        )
      );
      snaps.docs.forEach((d) =>
        allReports.push({ docRef: d.ref, data: d.data() })
      );
    }
    if (allReports.length === 0) {
      toast.info('No reports to approve in this range.');
      return;
    }
    const toApprove = allReports.filter(
      (r) => r.data.status.toLowerCase() !== 'approved'
    );
    if (toApprove.length === 0) {
      toast.info('All reports are already approved.');
      return;
    }
    await Promise.all(
      toApprove.map((r) => updateDoc(r.docRef, { status: 'Approved' }))
    );
    toast.success(`Approved ${toApprove.length} report(s).`);
  };

  // ─── NEW: Mark Paid (fixes that BOTH fields get set) ───────────────────
  const handleMarkPaid = async () => {
    try {
      // 1) Gather *all* reports in window for manager + subordinates
      const team = [mgr, ...subs.filter((u) => u.uid !== mgr.uid)];
      let allReports = [];
      for (let u of team) {
        const snaps = await getDocs(
          query(
            collection(db, 'reports'),
            where('userId', '==', u.uid),
            where('createdAt', '>=', bStart),
            where('createdAt', '<=', bEnd)
          )
        );
        snaps.docs.forEach((d) => allReports.push({ id: d.id, ...d.data() }));
      }

      if (allReports.length === 0) {
        return toast.info('No reports found in this date range.');
      }

      // 2) Check for any still–pending → abort if so
      const pending = allReports.filter((r) =>
        r.status.toLowerCase() === 'pending'
      );
      if (pending.length > 0) {
        return toast.error(
          `${pending.length} report(s) still pending – approve/reject first.`
        );
      }

      // 3) All “approved” & not yet officer‐paid
      const toPayOfficer = allReports.filter(
        (r) =>
          r.status.toLowerCase() === 'approved' &&
          (r.paymentStatus || '').toLowerCase() !== 'paid'
      );
      // 4) All “approved” & officer‐paid but not yet manager‐paid
      const toPayMgr = allReports.filter(
        (r) =>
          r.status.toLowerCase() === 'approved' &&
          (r.paymentStatus || '').toLowerCase() === 'paid' &&
          (r.managerCommission || '').toLowerCase() !== 'paid'
      );

      if (toPayOfficer.length === 0 && toPayMgr.length === 0) {
        return toast.info('All approved reports in this range are already fully paid.');
      }

      // 5) Mark officer‐level (paymentStatus)
      await Promise.all(
        toPayOfficer.map((r) =>
          updateDoc(doc(db, 'reports', r.id), { paymentStatus: 'paid' })
        )
      );

      // 6) Mark manager‐level (managerCommission)
      await Promise.all(
        toPayMgr.map((r) =>
          updateDoc(doc(db, 'reports', r.id), { managerCommission: 'paid' })
        )
      );

      // 7) Write a single paymentHistory entry
      const nowPaid = [...toPayOfficer, ...toPayMgr];
      const paidCIDs = Array.from(new Set(nowPaid.map((r) => r.companyId)));
      const numberOfReports = nowPaid.length;

      await addDoc(collection(db, 'paymentHistory'), {
        managerIds: [mgr.companyId],
        dateRange: { start: bStart, end: bEnd },
        paidAt: Timestamp.now(),
        subordinateIds: paidCIDs,
        numberOfReports,
      });

      toast.success(`Marked ${numberOfReports} report(s) paid.`);
      setActiveTab('history');
    } catch (err) {
      console.error(err);
      toast.error('Error marking paid: ' + err.message);
    }
  };

  return (
    <div>
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

      <div className="min-h-screen bg-gray-50 p-6">
        <button
          onClick={() => navigate('/admin/employee-summary')}
          className="mb-4 text-indigo-600 hover:underline"
        >
          &larr; Back
        </button>

        <h2 className="text-2xl font-bold text-gray-800 mb-6">
          Team under {mgr.name} ({mgr.companyId})
        </h2>

        {/* Tabs */}
        <div className="flex border-b mb-6">
          {['current', 'history'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 -mb-px font-medium ${
                activeTab === tab
                  ? 'border-b-2 border-indigo-500 text-indigo-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {tab === 'current' ? 'Current' : 'History'}
            </button>
          ))}
        </div>

        {activeTab === 'current' && (
          <>
            {/* Date selector */}
            <div className="mb-4">
              <DateRangePicker
                value={dateType}
                onChangeType={setDateType}
                customRange={customRange}
                onChangeCustom={(delta) =>
                  setCustomRange((cr) => ({ ...cr, ...delta }))
                }
              />
            </div>

            <div className="mb-4 space-x-4">
              <button
                onClick={handleApproveAll}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
              >
                Approve All
              </button>
              <button
                onClick={handleMarkPaid}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Mark Paid
              </button>
            </div>

            {/* Team table */}
            <div className="overflow-x-auto bg-white rounded-lg shadow">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    {[
                      'Officer ID',
                      'Name',
                      'Total',
                      'Approved',
                      'Pending',
                      'Rejected',
                      'Actions',
                    ].map((h) => (
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
                  {subs.map((u, i) => (
                    <tr key={u.uid} className={i % 2 ? 'bg-gray-50' : ''}>
                      <td className="px-6 py-4">{u.companyId}</td>
                      <td className="px-6 py-4">{u.name}</td>
                      <td className="px-6 py-4">{u.total}</td>
                      <td className="px-6 py-4">{u.approved}</td>
                      <td className="px-6 py-4">{u.pending}</td>
                      <td className="px-6 py-4">{u.rejected}</td>
                      <td className="px-6 py-4 space-x-2">
                        <button
                          onClick={() =>
                            navigate(`/summary/${u.uid}`, {
                              state: { range: { start, end } },
                            })
                          }
                          className="px-3 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600 text-sm"
                        >
                          View Reports
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 space-x-4">
              <button
                onClick={handleEmpDownload}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                Download (Officer)
              </button>
              <button
                onClick={handleMgrDownload}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                Download (Manager)
              </button>
            </div>
          </>
        )}

        {activeTab === 'history' && (
          <div className="overflow-x-auto bg-white rounded-lg shadow">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  {[
                    'Date Range',
                    'Paid At',
                    'Manager ID',
                    'Paid Company IDs',
                    '# Reports',
                    'Actions',
                  ].map((h) => (
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
                {history.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-4 text-center text-gray-500"
                    >
                      No payment history.
                    </td>
                  </tr>
                ) : (
                  history.map((entry, i) => {
                    const s = entry.dateRange.start.toDate();
                    const e = entry.dateRange.end.toDate();
                    return (
                      <tr
                        key={entry.id}
                        className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                      >
                        <td className="px-6 py-3 text-sm text-gray-800">
                          {s.toLocaleDateString()} – {e.toLocaleDateString()}
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-800">
                          {entry.paidAt.toDate().toLocaleString()}
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-800">
                          {mgr.companyId}
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-800">
                          {entry.paidCompanyIds.join(', ')}
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-800">
                          {entry.numberOfReports}
                        </td>
                        <td className="px-6 py-3 text-sm">
                          <button
                            onClick={() => {
                              setActiveTab('current');
                              setDateType('custom');
                              setCustomRange({ start: s, end: e });
                            }}
                            className="px-3 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600"
                          >
                            View Reports
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
