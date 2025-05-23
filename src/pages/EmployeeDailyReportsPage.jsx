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
      const bEnd= Timestamp.fromDate(end);

  useEffect(() => {
    (async () => {
      // 1️⃣ load the user’s name
      const userSnap = await getDoc(doc(db, 'users', userId));
      setName(userSnap.exists() ? userSnap.data().name : 'Unknown Employee');

      // 2️⃣ fetch all reports by this user
     const q = query(
       collection(db, 'reports'),
       where('userId',    '==', userId),
       where('createdAt','>=', bStart),
       where('createdAt','<=', bEnd)
    );
      const snap = await getDocs(q);

      // 3️⃣ filter by date window
     const filtered = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        // Firestore query already gives us >= bStart && <= bEnd,
        // so you can skip this filter altogether,
        // or, if you still want to guard in-memory, do:
        .filter(r => {
          if (!r.createdAt) return false;
          const ms = r.createdAt.toMillis();
          return ms >= bStart.toMillis() && ms <= bEnd.toMillis();
        });

      setReports(filtered);
       // 3️⃣ just take everything the query already gave us
      const results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setReports(results);
      setLoading(false);
    })();
  }, [userId, start, end]);

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
      // refresh in‑memory
      setReports(reports.map(r =>
        r.status.toLowerCase() === 'pending' ? { ...r, status:'approved' } : r
      ));
    } catch (err) {
      console.error(err);
      alert('Error approving all: ' + err.message);
    } finally {
      setApproving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-gray-500">Loading…</p>
    </div>
  );

  return (
    <div className="p-6 min-h-screen bg-gray-50">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 text-indigo-600 hover:underline"
      >
        &larr; Back
      </button>

      <h2 className="text-xl font-bold mb-4">
        Reports for {employeeName}
      </h2>

      {/* Approve All */}
     
      <div className="mb-4">
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
      </div>
      

      {reports.length === 0 ? (
        <p className="text-gray-600">No reports in this date range.</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="min-w-full">
            <thead className="bg-gray-100">
              <tr>
                {['Student','Grade','Course','Status','Actions'].map(h=>(
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
              {reports.map(r=>(
                <tr key={r.id} className="border-b">
                  <td className="px-4 py-2 text-gray-800">{r.studentName}</td>
                  <td className="px-4 py-2 text-gray-800">{r.grade}</td>
                  <td className="px-4 py-2 text-gray-800">{r.course}</td>
                  <td className="px-4 py-2 text-gray-800">{r.status}</td>
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
