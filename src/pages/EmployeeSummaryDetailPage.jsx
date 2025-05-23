// src/pages/EmployeeSummaryDetailPage.jsx
import React, { useEffect, useState } from 'react';
import { toast, ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
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
  if (type === 'today') {
    const s = new Date(now); s.setHours(0,0,0,0);
    const e = new Date(now); e.setHours(23,59,59,999);
    return { start: s, end: e };
  }
  if (type === 'last7')  return { start: new Date(now - 6*864e5), end: now };
  if (type === 'last30') return { start: new Date(now - 29*864e5), end: now };
  if (type === 'custom' && custom.start && custom.end) {
    return { start: custom.start, end: custom.end };
  }
  return { start: now, end: now };
}

export default function EmployeeSummaryDetailPage({ hideActions = false }) {
  const { state } = useLocation();
   const mgr = state?.manager;

  // redirect if we landed here without a manager
  const navigate = useNavigate();
  useEffect(() => {
    if (!mgr) {
      navigate('/admin/employee-summary', { replace: true });
    }
  }, [mgr, navigate]);
  

  const [subs,       setSubs]       = useState([]);
  const [history,    setHistory]    = useState([]);
  const [activeTab,  setActiveTab]  = useState('current');
  const [dateType,   setDateType]   = useState('today');
  const [customRange,setCustomRange]= useState({ start: null, end: null });
  const [loading,    setLoading]    = useState(true);

  // 1) Always compute this at top
  const { start, end } = getDateRange(dateType, customRange);
  const bStart = Timestamp.fromDate(start);
  const bEnd   = Timestamp.fromDate(end);

  useEffect(() => {
    if (!mgr) return;
    setLoading(true);

    (async () => {
      if (activeTab === 'current') {
        // fetch manager + subordinates
        const usSnap = await getDocs(
          query(
            collection(db,'users'),
            where('supervisorId','==', mgr.companyId)
          )
        );
        const team = [
          { uid: mgr.uid, name: mgr.name, companyId: mgr.companyId },
          ...usSnap.docs.map(d => ({ uid: d.id, ...d.data() }))
        ];

         // 2) count reports in range & compute per‑user allApproved
      let enriched = await Promise.all(
        team.map(async u => {
          const snaps = await getDocs(
            query(
              collection(db,'reports'),
              where('userId','==', u.uid),
              where('createdAt','>=', bStart),
              where('createdAt','<=', bEnd)
            )
          );
          const docs = snaps.docs.map(d => d.data());
          const reportCount = docs.length;
          // only true if every one of their reports is approved
          const allApproved = docs.length > 0 &&
                              docs.every(r => r.status.toLowerCase() === 'approved');
          return { ...u, reportCount, allApproved };
        })
      );
       // 3) sort team alphabetically by name
      enriched.sort((a, b) => a.name.localeCompare(b.name));
        setSubs(enriched);
      } else {
        // history tab
        const hSnap = await getDocs(
          query(
            collection(db,'paymentHistory'),
            where('employeeId','==', mgr.companyId)
          )
        );
        setHistory(hSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
      setLoading(false);
    })();
  }, [activeTab, dateType, customRange, mgr]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-600">Loading…</p>
      </div>
    );
  }

  // helper to build filenames
  const filenameBase = () => {
    const f = d => d.toISOString().slice(0,10);
    const a = f(start);
    const b = f(end);
    return mgr.companyId + '_' + (a === b ? a : `${a}_to_${b}`);
  };

  // 1) officer authorize & download
const handleEmpDownload = async () => {
  // gather both manager + all subs
  const team = [mgr, ...subs.filter(u => u.uid !== mgr.uid)];
  const { start, end } = getDateRange(dateType, customRange);
  const bStart = Timestamp.fromDate(start), bEnd = Timestamp.fromDate(end);

  let rows = [];
  for (let u of team) {
    const snaps = await getDocs(query(
      collection(db,'reports'),
      where('userId','==', u.uid),
      where('createdAt','>=', bStart),
      where('createdAt','<=', bEnd)
    ));
    snaps.docs.forEach(d => {
      const r = d.data();
      rows.push({
        'Officer ID':     u.companyId,
        'Officer Name':   u.name,
        'Student':        r.studentName,
        'Grade':          r.grade,
        'Course':         r.course,
        'Status':         r.status,
        'Created At':     r.createdAt.toDate().toLocaleString(),
        'Officer Commission': 2000
      });
    });
  }
  if (!rows.length) return alert('No reports in range.');
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Officer Reports');
  XLSX.writeFile(wb, `${filenameBase()}_officer.xlsx`);
};

// 2) officer mark paid
const handleEmpMarkPaid = async () => {
  // 1) Enforce cutoff: end ≤ day‑before‑yesterday
  const { start, end } = getDateRange(dateType, customRange)
  const today    = new Date()
  const cutoff   = new Date(today.setDate(today.getDate() - 2)) // day‑before‑yesterday
  cutoff.setHours(23, 59, 59, 999)

  if (end > cutoff) {
    toast.error("You can only pay for ranges ending by day‑before‑yesterday.")
    return
  }

  const bStart = Timestamp.fromDate(start)
  const bEnd   = Timestamp.fromDate(end)

  // 2) Gather *all* reports in the window for manager + subordinates
  const usersToCheck = [ mgr, ...subs.filter(u => u.uid !== mgr.uid) ]
  let allReports = []
  for (let u of usersToCheck) {
    const snaps = await getDocs(query(
      collection(db, 'reports'),
      where('userId','==', u.uid),
      where('createdAt','>=', bStart),
      where('createdAt','<=', bEnd)
    ))
    allReports.push(
      ...snaps.docs.map(d => ({ id: d.id, ...d.data() }))
    )
  }

  // 3) If any are still pending, abort
  const pending = allReports.filter(r => r.status.toLowerCase() === 'pending')
  if (pending.length > 0) {
    toast.error(`${pending.length} report(s) still pending – approve/reject first.`)
    return
  }

  // 4) Find approved & not paymentStatus:'paid'
  const toPay = allReports
    .filter(r => r.status.toLowerCase() === 'approved')
    .filter(r => (r.paymentStatus || '').toLowerCase() !== 'paid')

  if (toPay.length === 0) {
    toast.info("All approved reports in this range are already paid.")
    return
  }

  // 5) Mark them paid
  await Promise.all(
    toPay.map(r =>
      updateDoc(doc(db,'reports',r.id), { paymentStatus: 'paid' })
    )
  )

  toast.success(`Marked ${toPay.length} report(s) paid.`)
}

// 3) manager authorize & download
const handleMgrDownload = async () => {
  const { start, end } = getDateRange(dateType, customRange);
  const bStart = Timestamp.fromDate(start);
  const bEnd   = Timestamp.fromDate(end);

  let rows = [];

  // 1) Loop through subordinates only
  for (let u of subs.filter(u => u.uid !== mgr.uid)) {
    // 2) Query by userId + createdAt range only
    const snaps = await getDocs(
      query(
        collection(db, 'reports'),
        where('userId', '==', u.uid),
        where('createdAt', '>=', bStart),
        where('createdAt', '<=', bEnd),
        // <- removed where('status','==','approved') to avoid needing an index
      )
    );

    // 3) In‐JS filter for approved
    snaps.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(r => r.status?.toLowerCase() === 'approved')
      .forEach(r => {
        rows.push({
          'Officer ID':        u.companyId,
          'Officer Name':      u.name,
          'Student':           r.studentName,
          'Grade':             r.grade,
          'Course':            r.course,
          'Status':            r.status,
          'Created At':        r.createdAt.toDate().toLocaleString(),
          'Manager Commission': 500
        });
      });
  }

  if (!rows.length) {
    alert('No approved reports to download.');
    return;
  }

  // 4) Build & save Excel
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Manager Payouts');
  XLSX.writeFile(wb, `${filenameBase()}_manager.xlsx`);
};


// 4) manager mark paid
const handleMgrMarkPaid = async () => {
  try {
    // 1) Gather all subordinate UIDs
    const usersSnap = await getDocs(
      query(
        collection(db, 'users'),
        where('supervisorId', '==', mgr.companyId)
      )
    )
    const subUids = usersSnap.docs.map(d => d.id)
    if (subUids.length === 0) {
      toast.info("You have no subordinates.")
      return
    }

    // 2) Fetch all reports in the date range for those UIDs
    const { start, end } = getDateRange(dateType, customRange)
    const bStart = Timestamp.fromDate(start)
    const bEnd = Timestamp.fromDate(end)

    // Firestore can't do where-in over 10, so chunk if needed...
    const allReports = []
    const chunks = []
    for (let i = 0; i < subUids.length; i += 10) {
      chunks.push(subUids.slice(i, i + 10))
    }
    for (let chunk of chunks) {
      const snaps = await getDocs(
        query(
          collection(db, 'reports'),
          where('userId', 'in', chunk),
          where('createdAt', '>=', bStart),
          where('createdAt', '<=', bEnd)
        )
      )
      snaps.forEach(d => allReports.push({ id: d.id, ...d.data() }))
    }

    if (allReports.length === 0) {
      toast.info("No reports found in this date range.")
      return
    }

    // 3) Check employee-level paymentStatus
    const notEmpPaid = allReports.filter(r => r.paymentStatus !== 'paid')
    if (notEmpPaid.length > 0) {
      toast.error(
        `You must first mark ${notEmpPaid.length} report(s) paid at Employee level.`
      )
      return
    }

    // 4) Filter only approved & not yet manager-paid
    const toPayMgr = allReports.filter(r =>
      r.status.toLowerCase() === 'approved' &&
      r.managerCommission !== 'paid'
    )

    if (toPayMgr.length === 0) {
      toast.info("All approved reports are already manager‑paid.")
      return
    }

    // 5) Update managerCommission
    await Promise.all(
      toPayMgr.map(r =>
        updateDoc(doc(db, 'reports', r.id), { managerCommission: 'paid' })
      )
    )

    // 6) Log exactly one history entry
    // extract unique subordinate companyIds for these reports
const subordinateIds = Array.from(
  new Set(
    toPayMgr.map(r => {
      // each r.data().companyId was the officer who created it
      return r.companyId;
    })
  )
);

await addDoc(collection(db,'paymentHistory'), {
  // store the manager’s companyId instead of their uid
  employeeId: mgr.companyId,
  dateRange: { start: bStart, end: bEnd },
  paidAt:    Timestamp.now(),
  subordinateIds,
  numberOfReports: toPayMgr.length
});

    toast.success(`Marked ${toPayMgr.length} report(s) paid for manager.`)
    setActiveTab('history')

  } catch (err) {
    console.error(err)
    toast.error("Error marking paid: " + err.message)
  }
}


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
            <br />
           <br />
      <button
        onClick={()=>navigate('/admin/employee-summary')}
        className="mb-4 text-indigo-600 hover:underline"
      >
        &larr; Back
      </button>

      <h2 className="text-2xl font-bold text-gray-800 mb-6">
        Team under {mgr.name} ({mgr.companyId})
      </h2>

      {/* Tabs */}
      <div className="flex border-b mb-6">
        {['current','history'].map(tab => (
          <button
            key={tab}
            onClick={()=>setActiveTab(tab)}
            className={`px-4 py-2 -mb-px font-medium ${
              activeTab === tab
                ? 'border-b-2 border-indigo-500 text-indigo-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {tab==='current' ? 'Current' : 'History'}
          </button>
        ))}
      </div>

      {activeTab==='current' && (
        <>
          {/* Date selector */}
          <div className="mb-4">
            <DateRangePicker
              value={dateType}
              onChangeType={setDateType}
              customRange={customRange}
              onChangeCustom={delta =>
                setCustomRange(cr => ({ ...cr, ...delta }))
              }
            />
          </div>

          {/* Team table */}
          <div className="overflow-x-auto bg-white rounded-lg shadow">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  {['Officer ID','Name','# Reports','All Approved','Actions'].map(h=>(
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
                {subs.map((u,i) => (
                  <tr
                    key={u.uid}
                    className={i%2===0 ? 'bg-white' : 'bg-gray-50'}
                  >
                    <td className="px-6 py-4 text-sm text-gray-900">{u.companyId}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{u.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{u.reportCount}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {u.allApproved ? 'Yes' : 'No'}
                    </td>
                    <td className="px-6 py-4 space-x-2">
                      <button
                        onClick={()=>navigate(
                          `/summary/${u.uid}`,
                          { state: { range: { start, end } } }
                        )}
                        className="px-3 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600 text-sm"
                      >
                        View Reports
                      </button>
                    </td>
                  </tr>
                ))}
                {subs.length===0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                      No team members.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Actions */}
         <div className="mt-6 space-x-4">
  <button onClick={handleEmpDownload}  className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
    Auth & DL (Officer)
  </button>
  <button onClick={handleMgrDownload}  className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
    Auth & DL (Manager)
  </button>
  </div>

  <div className="mt-6 space-x-4">
  <button onClick={handleEmpMarkPaid} className="px-4 py-2 bg-green-600  text-white rounded hover:bg-green-700">
    Mark Paid (Officer)
  </button>
  <button onClick={handleMgrMarkPaid} className="px-4 py-2 bg-green-600  text-white rounded hover:bg-green-700">
    Mark Paid (Manager)
  </button>
  </div>


        </>
      )}

      {activeTab==='history' && (
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
  <tr>
    {[
      'Date Range',
      'Paid At',
      'Manager Company ID',
      'Officers Paid',
      '# Reports',
      'Actions'
    ].map(h => (
      <th key={h}
          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
        {h}
      </th>
    ))}
  </tr>
</thead>
<tbody className="bg-white divide-y divide-gray-200">
  {history.length === 0 ? (
    <tr>
      <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
        No payment history.
      </td>
    </tr>
  ) : history.map((entry, i) => {
    const s = entry.dateRange.start.toDate();
    const e = entry.dateRange.end.toDate();
    return (
      <tr key={entry.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
        <td className="px-6 py-3 text-sm text-gray-800">
          {s.toLocaleDateString()} – {e.toLocaleDateString()}
        </td>
        <td className="px-6 py-3 text-sm text-gray-800">
          {entry.paidAt.toDate().toLocaleString()}
        </td>
        <td className="px-6 py-3 text-sm text-gray-800">
          {entry.employeeId}
        </td>
        <td className="px-6 py-3 text-sm text-gray-800">
          {(entry.subordinateIds || []).join(', ')}
        </td>
        <td className="px-6 py-3 text-sm text-gray-800">
          {entry.numberOfReports ?? 0}
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
  })}
</tbody>


          </table>
        </div>
      )}
    </div>
    </div>
   
  );
}
