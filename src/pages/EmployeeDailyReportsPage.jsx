// src/pages/EmployeeDailyReportsPage.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  collection,
  doc,
  getDoc,
  query,
  where,
  getDocs,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import * as XLSX from 'xlsx';

export default function EmployeeDailyReportsPage({ hideApprove = false }) {
  const { userId } = useParams();               // UID of the employee
  const navigate   = useNavigate();
  const { state }  = useLocation();
  const [reports, setReports]     = useState([]);
  const [employeeName, setName]   = useState('');
  const [loading, setLoading]     = useState(true);
  const [approving, setApproving] = useState(false);

  // determine date window
  const { start, end } = state?.range
    ? {
        start:
          state.range.start instanceof Date
            ? state.range.start
            : new Date(state.range.start),
        end:
          state.range.end instanceof Date
            ? state.range.end
            : new Date(state.range.end),
      }
    : (() => {
        const now = new Date();
        const s = new Date(now); s.setHours(0,0,0,0);
        const e = new Date(now); e.setHours(23,59,59,999);
        return { start: s, end: e };
      })();

  const bStart= Timestamp.fromDate(start);
  const bEnd  = Timestamp.fromDate(end);

  useEffect(() => {
    (async () => {
      // 1️⃣ load the user’s name
      const userSnap = await getDoc(doc(db, 'users', userId));
      setName(userSnap.exists() ? userSnap.data().name : 'Unknown Employee');

      // 2️⃣ fetch all reports by this user in range
      const q = query(
        collection(db, 'reports'),
        where('userId',    '==', userId),
        where('createdAt','>=', bStart),
        where('createdAt','<=', bEnd)
      );
      const snap = await getDocs(q);
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setReports(rows);
      setLoading(false);
    })();
  }, [userId, bStart, bEnd]);

  const pending = reports.filter(r => r.status.toLowerCase() === 'pending');
  const canApproveAll = pending.length > 0;

  const handleApproveAll = async () => {
    if (!canApproveAll) return;
    setApproving(true);
    try {
      await Promise.all(
        pending.map(r =>
          updateDoc(doc(db,'reports',r.id), { status: 'approved' })
        )
      );
      setReports(reports.map(r =>
        r.status.toLowerCase() === 'pending'
          ? { ...r, status:'approved' }
          : r
      ));
    } finally {
      setApproving(false);
    }
  };

  const handleDownload = () => {
    const rows = reports.map((r, idx) => ({
      'S. No.':           idx + 1,
      'Student Name':     r.studentName,
      'Student Phone':    r.studentPhone,
      'Grade':            r.grade,
      'Course':           r.course,
      'Purchase Date':    r.purchaseDate
                            ? new Date(r.purchaseDate.seconds * 1000).toLocaleDateString()
                            : new Date(r.createdAt.seconds * 1000).toLocaleDateString(),
      'Status':           r.status,
    }));
    if (!rows.length) return alert('No reports to download.');
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reports');
    XLSX.writeFile(wb, `reports_${start.toISOString().slice(0,10)}_to_${end.toISOString().slice(0,10)}.xlsx`);
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-gray-500">Loading…</p>
    </div>
  );

  return (

    <div className="p-6 min-h-screen bg-gray-50">
        <br />
        <br />
      <button
        onClick={() => navigate(-1)}
        className="mb-4 text-indigo-600 hover:underline"
      >
        &larr; Back
      </button>

      <h2 className="text-2xl font-extrabold text-[#8a1ccf] mb-4">
        Reports for {employeeName}
      </h2>

      <div className="flex flex-wrap gap-4 mb-4">
        {!hideApprove && (
          <button
            disabled={!canApproveAll || approving}
            onClick={handleApproveAll}
            className={`px-4 py-2 rounded ${
              canApproveAll
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-300 text-gray-600 cursor-not-allowed'
            }`}
          >
            {approving ? 'Approving…' : 'Approve All'}
          </button>
        )}
        <button
          onClick={handleDownload}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
        >
          Download Reports
        </button>
      </div>

      {reports.length === 0 ? (
        <p className="text-gray-600">No reports in this date range.</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="min-w-full">
            <thead className="bg-gray-100">
              <tr>
                {[
                  'S. No.',
                  'Student',
                  'Student Phone',
                  'Grade',
                  'Course',
                  'Purchase Date',
                  'Status',
                  'Actions'
                ].map(h=>(
                  <th
                    key={h}
                    className="px-4 py-2 text-left text-sm font-medium text-gray-600"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reports.map((r,i)=>(
                <tr key={r.id} className="border-b">
                  <td className="px-4 py-2">{i+1}</td>
                  <td className="px-4 py-2">{r.studentName}</td>
                  <td className="px-4 py-2">{r.studentPhone}</td>
                  <td className="px-4 py-2">{r.grade}</td>
                  <td className="px-4 py-2">{r.course}</td>
                  <td className="px-4 py-2">
                    {r.purchaseDate
                      ? new Date(r.purchaseDate.seconds * 1000).toLocaleDateString()
                      : new Date(r.createdAt.seconds * 1000).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2">{r.status}</td>
                  <td className="px-4 py-2">
                    <button
                      onClick={()=>navigate(`/view/${r.id}`)}
                      className="px-2 py-1 bg-[#8a1ccf] text-white rounded hover:bg-[#7a1bbf] transition text-sm"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
