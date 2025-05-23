// src/pages/AdminEmployeeSummaryPage.jsx
import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import DateRangePicker from '../Components/DateRangePicker'; // your shared picker

export default function AdminEmployeeSummaryPage() {
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);

  // date‐range state
  const [dateType, setDateType] = useState('today');
  const [customRange, setCustomRange] = useState({ start: null, end: null });

  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      setLoading(true);

      // compute our timestamp bounds once per run
      const { start, end } = (() => {
        const now = new Date();
        if (dateType === 'today') {
          const s = new Date(now); s.setHours(0,0,0,0);
          const e = new Date(now); e.setHours(23,59,59,999);
          return { start: Timestamp.fromDate(s), end: Timestamp.fromDate(e) };
        }
        if (dateType === 'last7') {
          const s = new Date(now - 6 * 864e5);
          return { start: Timestamp.fromDate(s), end: Timestamp.fromDate(now) };
        }
        if (dateType === 'last30') {
          const s = new Date(now - 29 * 864e5);
          return { start: Timestamp.fromDate(s), end: Timestamp.fromDate(now) };
        }
        if (dateType === 'custom' && customRange.start && customRange.end) {
          return {
            start: Timestamp.fromDate(customRange.start),
            end:   Timestamp.fromDate(customRange.end),
          };
        }
        // fallback to today
        const s = new Date(now); s.setHours(0,0,0,0);
        const e = new Date(now); e.setHours(23,59,59,999);
        return { start: Timestamp.fromDate(s), end: Timestamp.fromDate(e) };
      })();

      // 1) fetch all managers
      const usersSnap = await getDocs(
        query(collection(db, 'users'), where('role', '==', 'manager'))
      );
      const mgrs = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() }));

      // 2) for each manager, fetch all their reports and filter in-memory
      let withCounts = await Promise.all(
        mgrs.map(async mgr => {
          const reportsRef = collection(db, 'reports');
          const mgrQuery   = query(reportsRef, where('managerId', '==', mgr.companyId));
          const snap       = await getDocs(mgrQuery);

          const countInRange = snap.docs.filter(doc => {
            const ts = doc.data().createdAt;
            return ts && ts.toMillis() >= start.toMillis() && ts.toMillis() <= end.toMillis();
          }).length;

          return { ...mgr, reportsToday: countInRange };
        })
      );

      // 3) sort alphabetically by manager name
      withCounts.sort((a, b) => a.name.localeCompare(b.name));

      setManagers(withCounts);
      setLoading(false);
    })();
  }, [dateType, customRange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Date selector */}
      <br />
      <br />
      <br />
      <div className="mb-6 max-w-md">
        <DateRangePicker
          value={dateType}
          onChangeType={setDateType}
          customRange={customRange}
          onChangeCustom={delta =>
            setCustomRange(cr => ({ ...cr, ...delta }))
          }
        />
      </div>

      <h2 className="text-2xl font-bold text-gray-800 mb-4">Employee Summary</h2>

      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              {['Manager ID', 'Name', '# Reports', 'Actions'].map(hdr => (
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
            {managers.map(mgr => (
              <tr key={mgr.uid}>
                <td className="px-6 py-4 text-sm text-gray-900">{mgr.companyId}</td>
                <td className="px-6 py-4 text-sm text-gray-900">{mgr.name}</td>
                <td className="px-6 py-4 text-sm text-gray-900">{mgr.reportsToday}</td>
                <td className="px-6 py-4 space-x-2">
                  <button onClick={() => navigate(`/admin/employee-summary/${mgr.uid}`, {state: { manager: mgr }})}
                                     className="px-3 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition"
                 >
                  
                    View Summary
                  </button>
                </td>
              </tr>
            ))}
            {managers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                  No managers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
