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
import DateRangePicker from '../Components/DateRangePicker';
import SearchBar       from '../Components/SearchBar';
import { getDateRange } from '../utils/dateUtils';

export default function AdminEmployeeSummaryPage() {
  const [managers,    setManagers]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [queryText,   setQueryText]   = useState('');

  // date‐range state
  const [dateType,    setDateType]    = useState('today');
  const [customRange, setCustomRange] = useState({ start: null, end: null });

  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      setLoading(true);

      // 1) Compute our JS Date window via the shared util
      const { start: jsStart, end: jsEnd } = getDateRange(dateType, customRange);
      // make sure both are valid Date objects
      if (!(jsStart instanceof Date) || !(jsEnd instanceof Date)) {
        // shouldn't happen unless customRange is invalid
        setManagers([]);
        setLoading(false);
        return;
      }
      const start = Timestamp.fromDate(jsStart);
      const end   = Timestamp.fromDate(jsEnd);

      // 2) Fetch all managers
      const usersSnap = await getDocs(
        query(collection(db, 'users'), where('role', '==', 'manager'))
      );
      const mgrs = usersSnap.docs.map(d => ({
        uid:       d.id,
        name:      d.data().name,
        companyId: d.data().companyId,
      }));

      // 3) For each manager, count reports in our window
      const withCounts = await Promise.all(
        mgrs.map(async mgr => {
          const rptSnap = await getDocs(
            query(
              collection(db, 'reports'),
              where('managerId', '==', mgr.companyId)
            )
          );
          const countInRange = rptSnap.docs.filter(doc => {
            const ts = doc.data().createdAt;
            return ts.toMillis() >= start.toMillis() && ts.toMillis() <= end.toMillis();
          }).length;
          return { ...mgr, reportCount: countInRange };
        })
      );

      // 4) Sort by name
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

  // 5) Filter by search (name or companyId)
  const filtered = managers.filter(m =>
    m.name.toLowerCase().includes(queryText.toLowerCase()) ||
    m.companyId.toLowerCase().includes(queryText.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <br /><br /><br />

      <div className="mb-6 max-w-md">
        <DateRangePicker
          value={dateType}
          onChangeType={setDateType}
          customRange={customRange}
          onChangeCustom={delta => setCustomRange(cr => ({ ...cr, ...delta }))}
        />
      </div>

      <h2 className="text-2xl font-bold text-gray-800 mb-4">Employee Summary</h2>

      {/* Search bar */}
      <div className="mb-4 max-w-sm">
        <SearchBar
          query={queryText}
          setQuery={setQueryText}
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              {['Manager ID','Name','# Reports','Actions'].map(hdr => (
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
            {filtered.length > 0 ? filtered.map(mgr => (
              <tr key={mgr.uid}>
                <td className="px-6 py-4 text-sm text-gray-900">{mgr.companyId}</td>
                <td className="px-6 py-4 text-sm text-gray-900">{mgr.name}</td>
                <td className="px-6 py-4 text-sm text-gray-900">{mgr.reportCount}</td>
                <td className="px-6 py-4 space-x-2">
                  <button
                    onClick={() =>
                      navigate(
                        `/admin/employee-summary/${mgr.uid}`,
                        { state: { manager: mgr } }
                      )
                    }
                    className="px-3 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600 text-sm"
                  >
                    View Summary
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                  No managers match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
