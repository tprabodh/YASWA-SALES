// src/pages/AdminBusinessHeadSummaryPage.jsx

import React, { useEffect, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import DateRangePicker from '../Components/DateRangePicker';
import { useUserProfile } from '../hooks/useUserProfile';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  doc,
  updateDoc,
  addDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

export default function AdminBusinessHeadSummaryPage() {
  const { profile, loading: authLoading } = useUserProfile();
  const navigate = useNavigate();

  const [rangeType, setRangeType]     = useState('today');
  const [customRange, setCustomRange] = useState({ start: null, end: null });
  const [data, setData]               = useState([]);
  const [loading, setLoading]         = useState(true);

  // 1) Compute start/end as Firestore Timestamps based on rangeType / customRange
  const computeRange = () => {
    const now = new Date();
    let start = null, end = null;

    switch (rangeType) {
      case 'today':
        start = new Date(now.setHours(0, 0, 0, 0));
        end   = new Date(now.setHours(23, 59, 59, 999));
        break;
      case 'yesterday': {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        start = new Date(d.setHours(0, 0, 0, 0));
        end   = new Date(d.setHours(23, 59, 59, 999));
        break;
      }
      case 'thisWeek': {
        const d = new Date();
        const day = d.getDay(); // 0 = Sunday
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
        start = new Date(d.setDate(diff));
        start.setHours(0, 0, 0, 0);
        end = new Date();
        end.setHours(23, 59, 59, 999);
        break;
      }
      case 'thisMonth': {
        const d = new Date();
        start = new Date(d.getFullYear(), d.getMonth(), 1);
        end   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      }
      case 'custom':
        start = customRange.start;
        end   = customRange.end;
        break;
      default:
        // fallback to today
        start = new Date(now.setHours(0, 0, 0, 0));
        end   = new Date(now.setHours(23, 59, 59, 999));
    }

    return {
      start: start ? Timestamp.fromDate(start) : null,
      end:   end ? Timestamp.fromDate(end) : null
    };
  };

  // 2) Fetch Business Heads + tally their reports
  useEffect(() => {
    if (authLoading) return;
    if (profile?.role !== 'admin') return;

    const { start, end } = computeRange();
    if (!start || !end) return;

    (async () => {
      setLoading(true);

      // 2.1) Get all users where role == 'businessHead'
      const bhSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'businessHead')));
      const summary = [];

      // Loop over each Business Head document
      for (let docBh of bhSnap.docs) {
        const bh = docBh.data();
        const bhCompId = bh.companyId;
        const bhName = bh.name || '—';
        const teleIds = Array.isArray(bh.telecallers) ? bh.telecallers : [];

        let approved = 0;
        let pending  = 0;
        let rejected = 0;

        // We will also collect unique employee/manager/telecaller IDs for paymentHistory entry
        const allEmployeeIds = new Set();
        const allManagerIds  = new Set();
        const allTelecallerIds = new Set(teleIds);

        // 2.2) For each telecaller under this BH:
        for (let tcId of teleIds) {
          // Fetch the telecaller’s user document to get its 'managing' array
          const tcSnap = await getDocs(query(collection(db, 'users'), where('companyId', '==', tcId)));
          if (tcSnap.empty) continue;

          const tcData = tcSnap.docs[0].data();
          const mgrIds = Array.isArray(tcData.managing) ? tcData.managing : [];

          // 2.3) For each manager under that telecaller, collect subordinates
          let empIds = [];
          for (let i = 0; i < mgrIds.length; i += 10) {
            const chunk = mgrIds.slice(i, i + 10);
            const mSnap = await getDocs(query(collection(db, 'users'), where('companyId', 'in', chunk)));
            mSnap.docs.forEach(d => {
              const m = d.data();
              const mgrCompId = m.companyId;
              allManagerIds.add(mgrCompId);

              // Each manager’s 'subordinates' array
              const subs = Array.isArray(m.subordinates) ? m.subordinates : [];
              subs.forEach(empCid => {
                empIds.push(empCid);
                allEmployeeIds.add(empCid);
              });
            });
          }

          // 2.4) Now fetch each batch of employee reports in [start,end]
          for (let i = 0; i < empIds.length; i += 10) {
            const chunk = empIds.slice(i, i + 10);
            const rSnap = await getDocs(
              query(
                collection(db, 'reports'),
                where('companyId', 'in', chunk),
                where('createdAt', '>=', start),
                where('createdAt', '<=', end)
              )
            );

            rSnap.docs.forEach(d => {
              const st = (d.data().status || '').toLowerCase();
              if (st === 'approved') approved++;
              else if (st === 'pending') pending++;
              else if (st === 'rejected') rejected++;
            });
          }
        }

        const total = approved + pending + rejected;
        const incentive = total * 100;

        summary.push({
          bhName,
          bhCompId,
          approved,
          pending,
          rejected,
          total,
          incentive
        });
      }

      setData(summary);
      setLoading(false);
    })();
  }, [authLoading, profile, rangeType, customRange]);

  // 3) Early‐return UI guards
  if (authLoading || loading) {
    return <p className="p-6">Loading…</p>;
  }
  if (profile?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  // 4) Download detailed report list for one Business Head
  const downloadForBH = async (bhCompId) => {
    const { start, end } = computeRange();
    if (!start || !end) return;

    const rows = [];
    // Reconstruct the same logic to gather every report in [start,end]
    const bhSnap = await getDocs(query(collection(db, 'users'), where('companyId', '==', bhCompId)));
    if (bhSnap.empty) return;
    const teleIds = Array.isArray(bhSnap.docs[0].data().telecallers) ? bhSnap.docs[0].data().telecallers : [];

    for (let tcId of teleIds) {
      const tcSnap = await getDocs(query(collection(db, 'users'), where('companyId', '==', tcId)));
      if (tcSnap.empty) continue;

      const tcData = tcSnap.docs[0].data();
      const tcName = tcData.name || '—';
      const mgrIds = Array.isArray(tcData.managing) ? tcData.managing : [];

      // Build a map from employee → (managerId, managerName)
      const empToMgr = {};
      let empIds = [];
      for (let i = 0; i < mgrIds.length; i += 10) {
        const chunk = mgrIds.slice(i, i + 10);
        const mSnap = await getDocs(query(collection(db, 'users'), where('companyId', 'in', chunk)));
        mSnap.docs.forEach(d => {
          const m = d.data();
          const mgrId = m.companyId;
          const mgrName = m.name || '—';
          (Array.isArray(m.subordinates) ? m.subordinates : []).forEach(empCid => {
            empIds.push(empCid);
            empToMgr[empCid] = { managerCompanyId: mgrId, managerName: mgrName };
          });
        });
      }

      for (let i = 0; i < empIds.length; i += 10) {
        const chunk = empIds.slice(i, i + 10);
        const rSnap = await getDocs(
          query(
            collection(db, 'reports'),
            where('companyId', 'in', chunk),
            where('createdAt', '>=', start),
            where('createdAt', '<=', end)
          )
        );
        rSnap.docs.forEach(d => {
          const rpt = d.data();
          const empCid = rpt.companyId;
          const meta = empToMgr[empCid] || {};

          rows.push({
            reportId:             d.id,
            studentName:          rpt.studentName || '',
            status:               rpt.status || '',
            createdAt:            rpt.createdAt.toDate().toLocaleString(),
            businessHeadCompanyId: bhCompId,
            telecallerCompanyId:   tcId,
            telecallerName:        tcName,
            managerCompanyId:      meta.managerCompanyId || '',
            managerName:           meta.managerName || '',
            employeeCompanyId:     empCid,
            incentive:             100
          });
        });
      }
    }

    if (rows.length === 0) {
      alert('No reports found for this Business Head in the selected range.');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reports');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(
      new Blob([wbout], { type: 'application/octet-stream' }),
      `BH_${bhCompId}_reports.xlsx`
    );
  };

  // 5) “Approve All” for one Business Head’s reports
  const approveAllForBH = async (bhCompId) => {
    const { start, end } = computeRange();
    if (!start || !end) return;

    // Gather every matching report DocumentSnapshot
    const bhSnap = await getDocs(query(collection(db, 'users'), where('companyId', '==', bhCompId)));
    if (bhSnap.empty) return;

    const teleIds = Array.isArray(bhSnap.docs[0].data().telecallers) ? bhSnap.docs[0].data().telecallers : [];
    let reportDocs = [];

    for (let tcId of teleIds) {
      const tcSnap = await getDocs(query(collection(db, 'users'), where('companyId', '==', tcId)));
      if (tcSnap.empty) continue;

      const mgrIds = Array.isArray(tcSnap.docs[0].data().managing) ? tcSnap.docs[0].data().managing : [];
      let empIds = [];

      for (let i = 0; i < mgrIds.length; i += 10) {
        const chunk = mgrIds.slice(i, i + 10);
        const mSnap = await getDocs(query(collection(db, 'users'), where('companyId', 'in', chunk)));
        mSnap.docs.forEach(d => {
          (Array.isArray(d.data().subordinates) ? d.data().subordinates : []).forEach(empCid => {
            empIds.push(empCid);
          });
        });
      }

      for (let i = 0; i < empIds.length; i += 10) {
        const chunk = empIds.slice(i, i + 10);
        const rSnap = await getDocs(
          query(
            collection(db, 'reports'),
            where('companyId', 'in', chunk),
            where('createdAt', '>=', start),
            where('createdAt', '<=', end)
          )
        );
        reportDocs.push(...rSnap.docs);
      }
    }

    if (reportDocs.length === 0) {
      alert('No reports found for this Business Head in the selected range.');
      return;
    }

    const notYetApproved = reportDocs.filter(docRef =>
      (docRef.data().status || '').toLowerCase() !== 'approved'
    );
    if (notYetApproved.length === 0) {
      alert('All reports are already approved.');
      return;
    }

    await Promise.all(
      notYetApproved.map(docRef =>
        updateDoc(doc(db, 'reports', docRef.id), { status: 'Approved' })
      )
    );
    alert(`Approved ${notYetApproved.length} report(s).`);
    // Trigger a reload
    setRangeType(rt => rt);
  };

  // 6) “Mark Paid” for one Business Head’s reports (sets all commission fields to 'paid', and records history)
  const markPaidForBH = async (bhCompId) => {
    const { start, end } = computeRange();
    if (!start || !end) return;

    // Gather every matching report DocumentSnapshot, but also collect ID chains
    const bhSnap = await getDocs(query(collection(db, 'users'), where('companyId', '==', bhCompId)));
    if (bhSnap.empty) return;

    const teleIds = Array.isArray(bhSnap.docs[0].data().telecallers) ? bhSnap.docs[0].data().telecallers : [];
    let reportDocs = [];
    const allEmployeeIds  = new Set();
    const allManagerIds   = new Set();
    const allTelecallerIds= new Set(teleIds);

    for (let tcId of teleIds) {
      const tcSnap = await getDocs(query(collection(db, 'users'), where('companyId', '==', tcId)));
      if (tcSnap.empty) continue;

      const mgrIds = Array.isArray(tcSnap.docs[0].data().managing) ? tcSnap.docs[0].data().managing : [];
      // Collect manager IDs
      mgrIds.forEach(mid => allManagerIds.add(mid));

      let empIds = [];
      for (let i = 0; i < mgrIds.length; i += 10) {
        const chunk = mgrIds.slice(i, i + 10);
        const mSnap = await getDocs(query(collection(db, 'users'), where('companyId', 'in', chunk)));
        mSnap.docs.forEach(d => {
          const subs = Array.isArray(d.data().subordinates) ? d.data().subordinates : [];
          subs.forEach(empCid => {
            empIds.push(empCid);
            allEmployeeIds.add(empCid);
          });
        });
      }

      for (let i = 0; i < empIds.length; i += 10) {
        const chunk = empIds.slice(i, i + 10);
        const rSnap = await getDocs(
          query(
            collection(db, 'reports'),
            where('companyId', 'in', chunk),
            where('createdAt', '>=', start),
            where('createdAt', '<=', end)
          )
        );
        reportDocs.push(...rSnap.docs);
      }
    }

    if (reportDocs.length === 0) {
      alert('No reports found to mark as paid in this range.');
      return;
    }

    // Filter out those already fully paid
    const toPay = reportDocs.filter(docRef => {
      const d = docRef.data();
      return !(
        (d.paymentStatus || '').toLowerCase() === 'paid' &&
        (d.managerCommission || '').toLowerCase() === 'paid' &&
        (d.telecallerCommission || '').toLowerCase() === 'paid' &&
        (d.businessHeadCommission || '').toLowerCase() === 'paid'
      );
    });

    if (toPay.length === 0) {
      alert('All reports are already marked paid.');
      return;
    }

    // 6.1) Update each report’s commission fields
    await Promise.all(
      toPay.map(docRef =>
        updateDoc(doc(db, 'reports', docRef.id), {
          paymentStatus:       'paid',
          managerCommission:   'paid',
          telecallerCommission:'paid',
          businessHeadCommission: 'paid'
        })
      )
    );

    // 6.2) Write one history entry
    const historyDoc = {
      businessHeadId:       bhCompId,
      paidAt:               Timestamp.now(),
      dateRange:            { start, end },
      numberOfReports:      toPay.length,
      employeeIds:          Array.from(allEmployeeIds),
      managerIds:           Array.from(allManagerIds),
      telecallerIds:        Array.from(allTelecallerIds)
    };
    await addDoc(collection(db, 'paymentHistory'), historyDoc);

    alert(`Marked ${toPay.length} report(s) paid and recorded history.`);
    // Refresh summary:
    setRangeType(rt => rt);
  };

  return (
    <div className="p-6">
      <br />
      <br />
      <h2 className="text-2xl font-bold mb-4">Business Heads Summary</h2>

      <DateRangePicker
        value={rangeType}
        onChangeType={setRangeType}
        customRange={customRange}
        onChangeCustom={setCustomRange}
      />

      <div className="overflow-x-auto bg-white rounded-lg shadow mt-4">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              {['Business Head','Approved','Pending','Rejected','Total','Incentive (₹)','Actions'].map(h => (
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
            {data.map((r, i) => (
              <tr key={i} className={i % 2 ? 'bg-gray-50' : ''}>
                <td className="px-6 py-3 text-sm text-gray-800">{`${r.bhName} (${r.bhCompId})`}</td>
                <td className="px-6 py-3 text-sm text-gray-800">{r.approved}</td>
                <td className="px-6 py-3 text-sm text-gray-800">{r.pending}</td>
                <td className="px-6 py-3 text-sm text-gray-800">{r.rejected}</td>
                <td className="px-6 py-3 text-sm text-gray-800">{r.total}</td>
                <td className="px-6 py-3 text-sm text-gray-800">₹{r.incentive}</td>
                <td className="px-6 py-3 text-sm space-x-2">
                  <button
                    onClick={() =>
                      navigate('/businesshead', {
                        state: { bhCompanyId: r.bhCompId, rangeType, customRange }
                      })
                    }
                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                  >
                    View Details
                  </button>

                  <button
                    onClick={() => downloadForBH(r.bhCompId)}
                    className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                  >
                    Download
                  </button>

                  <button
                    onClick={() => approveAllForBH(r.bhCompId)}
                    className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm"
                  >
                    Approve All
                  </button>

                  <button
                    onClick={() => markPaidForBH(r.bhCompId)}
                    className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm"
                  >
                    Mark Paid
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
