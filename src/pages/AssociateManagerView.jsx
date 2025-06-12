// src/pages/AssociateManagerView.jsx
import React, { useEffect, useState, useRef } from 'react';
import { Navigate, useNavigate }       from 'react-router-dom';
import { useUserProfile }              from '../hooks/useUserProfile';
import DateRangePicker                 from '../Components/DateRangePicker';
import SearchBar                       from '../Components/SearchBar';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp
} from 'firebase/firestore';
import * as XLSX                       from 'xlsx';
import { saveAs }                      from 'file-saver';
import { db }                          from '../firebase';
import { getDateRange }                from '../utils/dateUtils';

export default function AssociateManagerView() {
  // ─── 1. Hooks (always at top) ────────────────────────────────────────────────
  const { profile, loading }        = useUserProfile();
  const navigate                    = useNavigate();
  const [dateType,    setDateType]    = useState('today');
  const [customRange, setCustomRange] = useState({ start: null, end: null });
  const [search,      setSearch]      = useState('');
  const [rows,        setRows]        = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const dataRef                         = useRef([]);

  // ─── 2. Data‐loading effect (always called) ─────────────────────────────────
  useEffect(() => {
    // 2.1) If still loading auth, do nothing
    if (loading) return;

    // 2.2) If user is not an associateManager, do nothing
    if (!profile || profile.role !== 'associateManager') {
      return;
    }

    // 2.3) Otherwise, fetch the rows
    (async () => {
      setLoadingData(true);

      // 2.3.1) Get JS Date versions of [start,end]
      const { start: jsStart, end: jsEnd } = getDateRange(dateType, customRange);
      // (jsStart and jsEnd are plain Date objects, e.g. May 1 2025 00:00 and May 31 2025 23:59:59)
      // We'll compare reportDate >= jsStart && reportDate <= jsEnd in JS.

      // 2.3.2) Safely grab the associates‐CIDs array
      const assocCids = Array.isArray(profile.associates)
        ? profile.associates.filter(cid => typeof cid === 'string')
        : [];

      const temp = [];
      for (let cid of assocCids) {
        // 2.3.3) Lookup this associate’s name
        const uSnap = await getDocs(
          query(collection(db, 'users'), where('companyId', '==', cid))
        );
        if (uSnap.empty) continue;
        const { name } = uSnap.docs[0].data();

        // 2.3.4) Fetch ALL reports for that associate (no date filter yet)
        const allReportsSnap = await getDocs(
          query(collection(db, 'reports'), where('companyId', '==', cid))
        );

        // 2.3.5) In‐JS filter by createdAt → Date, count statuses
        let total=0, approved=0, pending=0, rejected=0;
        allReportsSnap.docs.forEach(d => {
          const rptData = d.data();
          const rptDate = rptData.createdAt.toDate(); // JS Date

          // If that JS Date is between jsStart ≤ rptDate ≤ jsEnd, count it
          if (rptDate.getTime() >= jsStart.getTime() &&
              rptDate.getTime() <= jsEnd.getTime())
          {
            total++;
            const s = (rptData.status || '').toLowerCase();
            if (s === 'approved')   approved++;
            else if (s === 'pending') pending++;
            else if (s === 'rejected') rejected++;
          }
        });

        temp.push({ cid, name, total, approved, pending, rejected });
      }

      dataRef.current = temp;
      setRows(temp);
      setLoadingData(false);
    })();
  }, [loading, profile, profile?.associates, dateType, customRange]);

  // ─── 3. Early‐return UI guards (after hooks) ────────────────────────────────────
  if (loading) {
    // Still waiting for useUserProfile()
    return <p>Loading profile…</p>;
  }
  if (!profile || profile.role !== 'associateManager') {
    // Not logged in or wrong role
    return <Navigate to="/" replace />;
  }
  if (loadingData) {
    // Still fetching the associates/reports data
    return <p>Loading data…</p>;
  }

  // ─── 4. Filter rows by search text (name OR cid) ────────────────────────────────
  const filtered = rows.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.cid.toLowerCase().includes(search.toLowerCase())
  );

  // ─── 5. “Download All Associates” button handler ────────────────────────────────
  const handleDownloadAll = () => {
    const sheet = dataRef.current.map(r => ({
      'Associate CID':  r.cid,
      'Associate Name': r.name,
      'Total':          r.total,
      'Approved':       r.approved,
      'Pending':        r.pending,
      'Rejected':       r.rejected,
    }));
    const ws = XLSX.utils.json_to_sheet(sheet);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Associates');
    const wbout = XLSX.write(wb, { bookType:'xlsx', type:'array' });
    saveAs(new Blob([wbout], { type:'application/octet-stream' }), 'associates_reports.xlsx');
  };

  // ─── 6. “Download One Associate’s Reports” handler ───────────────────────────────
  const handleDownloadOne = async (associateCid) => {
    // 6.1) Recompute JS [start,end]
    const { start: jsStart, end: jsEnd } = getDateRange(dateType, customRange);

    // 6.2) Fetch ALL reports for that associate
    const allSnap = await getDocs(
      query(collection(db, 'reports'), where('companyId', '==', associateCid))
    );

    // 6.3) In‐JS filter to only keep those within [jsStart, jsEnd]
    const rowsToExport = [];
    allSnap.docs.forEach(d => {
      const rptData = d.data();
      const rptDate = rptData.createdAt.toDate();
      if (rptDate.getTime() >= jsStart.getTime() &&
          rptDate.getTime() <= jsEnd.getTime())
      {
        rowsToExport.push({
          'Report ID':     d.id,
          'Associate CID': rptData.companyId,
          'Student Name':  rptData.studentName || '',
          'Course':        rptData.course    || '',
          'Status':        rptData.status    || '',
          'Created At':    rptDate.toLocaleString()
        });
      }
    });

    if (rowsToExport.length === 0) {
      alert('No reports in this date range for that associate.');
      return;
    }

    // 6.4) Export to Excel
    const ws = XLSX.utils.json_to_sheet(rowsToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'AssociateReports');
    const wbout = XLSX.write(wb, { bookType:'xlsx', type:'array' });
    saveAs(
      new Blob([wbout], { type:'application/octet-stream' }),
      `reports_${associateCid}.xlsx`
    );
  };

  // ─── 7. Final render ────────────────────────────────────────────────────────────
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Associate Manager Dashboard</h2>

      <div className="flex flex-wrap gap-4 items-center mb-4">
        {/* ── Download All at Left ──────────────────────────────────────────────── */}
        <button
          onClick={handleDownloadAll}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Download All Reports
        </button>

        {/* ── DateRangePicker ─────────────────────────────────────────────────── */}
        <DateRangePicker
          value={dateType}
          onChangeType={setDateType}
          customRange={customRange}
          onChangeCustom={setCustomRange}
        />

        {/* ── SearchBar ──────────────────────────────────────────────────────── */}
        <SearchBar
          query={search}
          setQuery={setSearch}
          className="max-w-sm"
        />
      </div>

      <div className="overflow-x-auto bg-white shadow rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              {['#','Associate','Total','Approved','Pending','Rejected','Actions'].map(h => (
                <th
                  key={h}
                  className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filtered.length > 0 ? (
              filtered.map((r, i) => (
                <tr key={r.cid} className={i % 2 ? 'bg-gray-50' : ''}>
                  <td className="px-4 py-2">{i + 1}</td>
                  <td className="px-4 py-2">{`${r.name} (${r.cid})`}</td>
                  <td className="px-4 py-2">{r.total}</td>
                  <td className="px-4 py-2">{r.approved}</td>
                  <td className="px-4 py-2">{r.pending}</td>
                  <td className="px-4 py-2">{r.rejected}</td>
                  <td className="px-4 py-2 space-x-2">
                    {/* ── View Reports ─────────────────────────────────── */}
                    <button
                      onClick={() =>
                        navigate(
                          `/associate-manager/reports/${r.cid}`,
                          {
                            state: {
                              associateCid: r.cid,
                              range: getDateRange(dateType, customRange)
                            }
                          }
                        )
                      }
                      className="px-2 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600 text-sm"
                    >
                      View Reports
                    </button>

                    {/* ── Download Reports for this associate ───────────── */}
                    <button
                      onClick={() => handleDownloadOne(r.cid)}
                      className="px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                    >
                      Download Reports
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-4 py-4 text-center text-gray-500">
                  No associates found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
