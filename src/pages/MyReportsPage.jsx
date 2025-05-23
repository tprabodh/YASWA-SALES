// src/pages/MyReportsPage.jsx
import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import useAuth from '../hooks/UseAuth';
import { useNavigate } from 'react-router-dom';
import DateRangePicker from '../Components/DateRangePicker';

export default function MyReportsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [allReports, setAllReports] = useState([]);

  // ⏳ Filter state
  const [dateType, setDateType] = useState('today');
  const [customRange, setCustomRange] = useState({ start: null, end: null });

  useEffect(() => {
    if (loading || !user) return;

    const q = query(
      collection(db, 'reports'),
      where('userId', '==', user.uid)
    );

    const unsub = onSnapshot(q, async (snap) => {
      const reportsData = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const uniqueCompanyIds = [
        ...new Set(reportsData.map((r) => r.companyId).filter(Boolean)),
      ];

      const companyIdToName = {};
      await Promise.all(
        uniqueCompanyIds.map(async (companyId) => {
          const usersQuery = query(
            collection(db, 'users'),
            where('companyId', '==', companyId)
          );
          const usersSnap = await getDocs(usersQuery);
          if (!usersSnap.empty) {
            const userDoc = usersSnap.docs[0];
            companyIdToName[companyId] = userDoc.data().name || 'N/A';
          } else {
            companyIdToName[companyId] = 'N/A';
          }
        })
      );

      const augmentedReports = reportsData.map((report) => ({
        ...report,
        employeeName: companyIdToName[report.companyId] || 'N/A',
      }));

      setAllReports(augmentedReports);
    });

    return () => unsub();
  }, [user, loading]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this report?')) return;
    await deleteDoc(doc(db, 'reports', id));
  };

  // 📆 Compute timestamp range for filtering
  const getFilteredReports = () => {
    if (dateType === 'allTime') return allReports;

    let start, end;
    const now = new Date();
    if (dateType === 'today') {
      start = new Date(); start.setHours(0, 0, 0, 0);
      end = new Date(); end.setHours(23, 59, 59, 999);
    } else if (dateType === 'last7') {
      start = new Date(now - 6 * 864e5);
      end = now;
    } else if (dateType === 'last30') {
      start = new Date(now - 29 * 864e5);
      end = now;
    } else if (dateType === 'custom' && customRange.start && customRange.end) {
      start = customRange.start;
      end = customRange.end;
    } else {
      return allReports;
    }

    return allReports.filter((r) => {
      const createdAt = r.createdAt?.toDate?.();
      return createdAt && createdAt >= start && createdAt <= end;
    });
  };

  const reports = getFilteredReports();

  if (loading) return <div>Loading…</div>;

  return (
    <div className="min-h-screen bg-white p-6 text-black">
      <br />
      <br />
      <h2 className="text-2xl font-bold mb-4">My Reports</h2>

      {/* 🔄 Date Picker */}
      <div className="mb-4 max-w-md">
        <DateRangePicker
          value={dateType}
          onChangeType={setDateType}
          customRange={customRange}
          onChangeCustom={(delta) =>
            setCustomRange((prev) => ({ ...prev, ...delta }))
          }
        />
      </div>

      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full table-auto">
          <thead className="bg-gray-100">
            <tr>
              {[
                'Student Name',
                'Course Purchased',
                'Status',
                'Employee Name',
                'Company ID',
                'Actions',
              ].map((header) => (
                <th
                  key={header}
                  className="px-6 py-3 text-left text-sm font-semibold"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reports.map((r, i) => (
              <tr
                key={r.id}
                className={`${i % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-gray-100`}
              >
                <td className="px-6 py-4">{r.studentName}</td>
                <td className="px-6 py-4">{r.course}</td>
                <td className="px-6 py-4">{r.status}</td>
                <td className="px-6 py-4">{r.employeeName}</td>
                <td className="px-6 py-4">{r.companyId}</td>
                <td className="px-6 py-4 space-x-2">
                  <button
                    className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-3 py-1 rounded"
                    onClick={() =>
                      navigate(`/view/${r.id}`, { state: { from: 'reports' } })
                    }
                  >
                    View
                  </button>
                  <button
                    className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs px-3 py-1 rounded"
                    onClick={() => navigate(`/submit/${r.id}`)}
                  >
                    Edit
                  </button>
                  <button
                    className="bg-red-500 hover:bg-red-600 text-white text-xs px-3 py-1 rounded"
                    onClick={() => handleDelete(r.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {reports.length === 0 && (
              <tr>
                <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                  No reports found for this date range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
