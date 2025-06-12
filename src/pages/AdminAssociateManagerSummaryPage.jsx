// src/pages/AdminAssociateManagerSummaryPage.jsx

import React, { useEffect, useState, useRef } from 'react';
import { Navigate }                  from 'react-router-dom';
import { useUserProfile }            from '../hooks/useUserProfile';
import { collection, query, where, getDoc, getDocs, updateDoc, doc, addDoc, Timestamp } from 'firebase/firestore';
import DateRangePicker               from '../Components/DateRangePicker';
import * as XLSX                     from 'xlsx';
import { saveAs }                    from 'file-saver';
import { db }                        from '../firebase';
import { getDateRange }              from '../utils/dateUtils';

export default function AdminAssociateManagerSummaryPage() {
  // ─────── State & Refs ────────────────────────────────────────────────────────
  const { profile, loading }       = useUserProfile();
  const [dateType,    setDateType]    = useState('today');
  const [customRange, setCustomRange] = useState({ start: null, end: null });
  const [rows,        setRows]        = useState([]);   // summary per associate‐manager
  const [loadingData, setLoadingData] = useState(true);
  const detailRef                     = useRef({});    // { [mgrUid]: [ { reportId, associateCid, ... }, ... ] }

  // ─────── Effect: Load summary & details ───────────────────────────────────────
  useEffect(() => {
    // 1) Wait until profile is ready
    if (loading) return;

    // 2) Only admins can access
    if (!profile || profile.role !== 'admin') {
      return;
    }

    // 3) Fetch summary information
    (async () => {
      setLoadingData(true);

      // 3.1) Compute [jsStart, jsEnd] Date objects from DateRangePicker
      const { start: jsStart, end: jsEnd } = getDateRange(dateType, customRange);

      // 3.2) Query all users with role === 'associateManager'
      const mgrSnap = await getDocs(
        query(collection(db, 'users'), where('role', '==', 'associateManager'))
      );
      const mgrDocs = mgrSnap.docs;

      const summaryRows = [];
      const allDetails = {};

      // 3.3) For each associate‐manager, accumulate their associates’ reports
      for (let d of mgrDocs) {
        const mgrData     = d.data();
        const mgrUid      = d.id;
        const mgrName     = mgrData.name || '—';
        const assocCids   = Array.isArray(mgrData.associates) ? mgrData.associates : [];

        let total    = 0;
        let approved = 0;
        let pending  = 0;
        let rejected = 0;
        const detailList = [];

        // 3.3.1) For each associate companyId under this manager:
        for (let cid of assocCids) {
          // 3.3.1.1) Fetch all reports where companyId === cid
          const rptSnap = await getDocs(
            query(collection(db, 'reports'), where('companyId', '==', cid))
          );
          for (let rptDoc of rptSnap.docs) {
            const rptData = rptDoc.data();
            if (!rptData.createdAt) continue;
            const rptDate = rptData.createdAt.toDate();

            // 3.3.1.2) JS‐level date filter
            if (
              rptDate.getTime() >= jsStart.getTime() &&
              rptDate.getTime() <= jsEnd.getTime()
            ) {
              total++;
              const s = (rptData.status || '').toLowerCase();
              if (s === 'approved')   approved++;
              else if (s === 'pending') pending++;
              else if (s === 'rejected') rejected++;

              // 3.3.1.3) Collect detail for later export & payment
              detailList.push({
                reportId:      rptDoc.id,
                associateCid:  cid,
                associateName: '',         // will fill below
                studentName:   rptData.studentName || '',
                course:        rptData.course || '',
                status:        rptData.status || '',
                createdAt:     rptDate.toLocaleString()
              });
            }
          }
        }

        // 3.3.2) Look up each associate’s name once, then fill in detailList.associateName
        const cidToName = {};
        for (let cid of assocCids) {
          if (!cidToName[cid]) {
            const userSnap = await getDocs(
              query(collection(db, 'users'), where('companyId', '==', cid))
            );
            cidToName[cid] = userSnap.empty ? '—' : userSnap.docs[0].data().name;
          }
        }
        detailList.forEach(r => {
          r.associateName = cidToName[r.associateCid] || '—';
        });

        // 3.3.3) Push summary row
        summaryRows.push({
          mgrUid,
          mgrName,
          total,
          approved,
          pending,
          rejected
        });
        allDetails[mgrUid] = detailList;
      }

      // 3.4) Update state & ref
      setRows(summaryRows);
      detailRef.current = allDetails;
      setLoadingData(false);
    })();
  }, [loading, profile, dateType, customRange]);

  // ─────── Guard UI: Loading & Authorization ─────────────────────────────────────
  if (loading) {
    return <p>Loading profile…</p>;
  }
  if (!profile || profile.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  if (loadingData) {
    return <p>Loading data…</p>;
  }

  // ─────── Helper: Download detail reports as Excel ─────────────────────────────────
  const handleDownloadOne = (mgrUid) => {
    const detailList = detailRef.current[mgrUid] || [];
    if (detailList.length === 0) {
      alert('No reports in this date range.');
      return;
    }
    const sheetData = detailList.map(r => ({
      'Report ID':      r.reportId,
      'Associate CID':  r.associateCid,
      'Associate Name': r.associateName,
      'Student Name':   r.studentName,
      'Course':         r.course,
      'Status':         r.status,
      'Created At':     r.createdAt
    }));
    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Detail');
    const wbout = XLSX.write(wb, { bookType:'xlsx', type:'array' });
    saveAs(new Blob([wbout], { type:'application/octet-stream' }), `assocMgr_${mgrUid}_reports.xlsx`);
  };

  // ─────── Helper: Approve all reports under one manager ─────────────────────────────
  const handleApproveAll = async (mgrUid) => {
    const detailList = detailRef.current[mgrUid] || [];
    const toApprove = detailList.filter(r => r.status.toLowerCase() !== 'approved');
    if (toApprove.length === 0) {
      alert('All reports are already approved in this date range.');
      return;
    }
    await Promise.all(toApprove.map(async (r) => {
      const ref = doc(db, 'reports', r.reportId);
      await updateDoc(ref, { status: 'Approved' });
    }));
    alert(`Approved ${toApprove.length} report${toApprove.length === 1 ? '' : 's'}.`);
    setDateType(dt => dt); // retrigger effect to refresh counts
  };

  // Place this inside your component, replacing the old handleMarkPaid:

const handleMarkPaid = async (mgrUid) => {
  try {
    // 1) Compute the Firestore Timestamps from the DateRangePicker:
    const { start: jsStart, end: jsEnd } = getDateRange(dateType, customRange);
    const startTS = Timestamp.fromDate(jsStart);
    const endTS   = Timestamp.fromDate(jsEnd);

    // 2) Read this associate‐manager’s Firestore document to get its companyId:
    const mgrDocRef = doc(db, 'users', mgrUid);
    const mgrDocSnap = await getDoc(mgrDocRef);
    if (!mgrDocSnap.exists()) {
      alert('Manager document not found.');
      return;
    }
    const managerCompanyId = mgrDocSnap.data().companyId;
    if (!managerCompanyId) {
      alert('Manager has no companyId field.');
      return;
    }

    // 3) Check “associatePaymentHistory” to see if we already paid for this date‐range:
    const historyQ = query(
      collection(db, 'associatePaymentHistory'),
      where('associateManagerCompanyId', '==', managerCompanyId),
      where('dateRange.start',            '==', startTS),
      where('dateRange.end',              '==', endTS)
    );
    const historySnap = await getDocs(historyQ);
    if (!historySnap.empty) {
      alert('Already marked paid for this Associate Manager & date range.');
      return;
    }

    // 4) Retrieve that manager’s detail list from our ref:
    const detailList = detailRef.current[mgrUid] || [];
    if (detailList.length === 0) {
      alert('No reports to mark paid in this date range.');
      return;
    }

    // 5) Update each report’s “associatePayment” and “associateManagerPayment” fields:
    await Promise.all(
      detailList.map(async (r) => {
        const rptDocRef = doc(db, 'reports', r.reportId);
        await updateDoc(rptDocRef, {
          associatePayment:        'paid',
          associateManagerPayment: 'paid'
        });
      })
    );

    // 6) Build a unique array of all associate CIDs in this manager’s detailList:
    const uniqueAssocCids = Array.from(new Set(detailList.map(r => r.associateCid)));

    // 7) Write one new document into “associatePaymentHistory”:
    await addDoc(collection(db, 'associatePaymentHistory'), {
      associateManagerCompanyId: managerCompanyId,
      associateIds:              uniqueAssocCids,
      numberOfReports:           detailList.length,
      dateRange: { start: startTS, end: endTS },
      paidAt: Timestamp.now()
    });

    alert(`Marked ${detailList.length} report${detailList.length === 1 ? '' : 's'} as paid.`);

    // 8) Retrigger the effect by nudging dateType (no actual change in value):
    setDateType(dt => dt);
  } catch (err) {
    console.error('Error in handleMarkPaid:', err);
    alert('Error marking paid: ' + err.message);
  }
};


  // ───────────────────────── Render ───────────────────────────────────────────────
  return (
    <div className="p-6">
        <br /><br />
      <h2 className="text-2xl font-bold mb-4">Associate Manager Summary</h2>

      <div className="flex flex-wrap gap-4 items-center mb-4">
        <DateRangePicker
          value={dateType}
          onChangeType={setDateType}
          customRange={customRange}
          onChangeCustom={setCustomRange}
        />
      </div>

      <div className="overflow-x-auto bg-white shadow rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              {[
                'S.no',
                'Associate Manager',
                'Total',
                'Approved',
                'Pending',
                'Rejected',
                'Actions'
              ].map(hdr => (
                <th
                  key={hdr}
                  className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                >
                  {hdr}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rows.length > 0 ? (
              rows.map((r, idx) => (
                <tr key={r.mgrUid} className={idx % 2 ? 'bg-gray-50' : ''}>
                  <td className="px-4 py-2">{idx + 1}</td>
                  <td className="px-4 py-2">{`${r.mgrName} (${r.mgrUid})`}</td>
                  <td className="px-4 py-2">{r.total}</td>
                  <td className="px-4 py-2">{r.approved}</td>
                  <td className="px-4 py-2">{r.pending}</td>
                  <td className="px-4 py-2">{r.rejected}</td>
                  <td className="px-4 py-2 space-x-2">
                    <button
                      onClick={() => handleDownloadOne(r.mgrUid)}
                      className="px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                    >
                      Download Reports
                    </button>
                    <button
                      onClick={() => handleApproveAll(r.mgrUid)}
                      className="px-2 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600 text-sm"
                    >
                      Approve All
                    </button>
                    <button
                      onClick={() => handleMarkPaid(r.mgrUid)}
                      className="px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm"
                    >
                      Mark Paid
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-4 py-4 text-center text-gray-500">
                  No associate managers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
