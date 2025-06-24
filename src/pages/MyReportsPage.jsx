import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import useAuth from '../hooks/UseAuth';
import { useUserProfile } from '../hooks/useUserProfile';
import { useNavigate } from 'react-router-dom';
import DateRangePicker from '../Components/DateRangePicker';

export default function MyReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile();
  const navigate = useNavigate();
  const [allReports, setAllReports] = useState([]);
  const [dateType, setDateType] = useState('today');
  const [customRange, setCustomRange] = useState({ start: null, end: null });

  useEffect(() => {
    if (authLoading || profileLoading || !user) return;
    const q = query(
      collection(db, 'reports'),
      where('userId', '==', user.uid)
    );
    const unsub = onSnapshot(q, async (snap) => {
      const reportsData = await Promise.all(
        snap.docs.map(async (docSnap) => {
          const data = docSnap.data();
          return { id: docSnap.id, ...data };
        })
      );
      setAllReports(reportsData);
    });
    return () => unsub();
  }, [authLoading, profileLoading, user]);

  if (authLoading || profileLoading) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
        <svg
          className="w-16 h-16 text-[#8a1ccf] animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none" viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12" cy="12" r="10"
            stroke="currentColor" strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8z"
          />
        </svg>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-6 text-red-500 bg-yellow-100 rounded-lg shadow-lg">
        Error loading your profile. Please try again.
      </div>
    );
  }

  const getFilteredReports = () => {
    const now = new Date();
    let start, end;

    if (dateType === 'today') {
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      end = new Date(now);
      end.setHours(23, 59, 59, 999);
    } else if (dateType === 'yesterday') {
      const yd = new Date(now);
      yd.setDate(yd.getDate() - 1);
      start = new Date(yd);
      start.setHours(0, 0, 0, 0);
      end = new Date(yd);
      end.setHours(23, 59, 59, 999);
    } else if (dateType === 'thisWeek') {
      const day = now.getDay();
      const diffToMon = (day + 6) % 7;
      const mon = new Date(now);
      mon.setDate(mon.getDate() - diffToMon);
      start = new Date(mon);
      start.setHours(0, 0, 0, 0);
      end = new Date(mon);
      end.setDate(mon.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else if (dateType === 'thisMonth') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      start.setHours(0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
    } else if (dateType === 'custom' && customRange.start instanceof Date && customRange.end instanceof Date) {
      start = customRange.start;
      end = customRange.end;
    } else {
      start = new Date(0);
      end = now;
    }

    return allReports.filter((r) => {
      const d = r.createdAt?.toDate?.();
      return d instanceof Date && d >= start && d <= end;
    });
  };

  const reports = getFilteredReports();

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this report?')) return;
    await deleteDoc(doc(db, 'reports', id));
  };

  return (
    <div className="min-h-screen bg-white p-8 text-black">
      <br /><br />
      <h2 className="text-2xl font-extrabold text-[#8a1ccf] mb-4">
        Hi {profile.name} ({profile.companyId}) — Your Sales Report Status
      </h2>

      <div className="mb-8 max-w-lg mx-auto bg-white p-6 rounded-lg shadow-lg">
        <DateRangePicker
          value={dateType}
          onChangeType={setDateType}
          customRange={customRange}
          onChangeCustom={(delta) => setCustomRange((prev) => ({ ...prev, ...delta }))}
        />
      </div>

      <div className="overflow-x-auto bg-white rounded-lg shadow-lg">
        <table className="min-w-full table-auto bg-gradient-to-r from-purple-100 to-indigo-50">
          <thead className="bg-gray-300">
            <tr>
              {['S No.', 'Student Name', 'Student Phone', 'Course Purchased', 'Purchased Date', 'Status', 'Actions'].map(
                (header) => (
                  <th
                    key={header}
                    className="px-6 py-3 text-left text-lg font-semibold text-gray-600 tracking-wide"
                  >
                    {header}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {reports.map((r, i) => {
              const isPending = r.status.toLowerCase() === 'pending';
              return (
                <tr key={r.id} className={`${i % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-indigo-50`}>
                  <td className="px-6 py-4 text-lg">{i + 1}</td>
                  <td className="px-6 py-4">{r.studentName}</td>
                  <td className="px-6 py-4">{r.studentPhone}</td>
                  <td className="px-6 py-4">{r.course}</td>
                  <td className="px-6 py-4">
                    {r.createdAt ? r.createdAt.toDate().toLocaleDateString() : '—'}
                  </td>
                  <td className="px-6 py-4">{r.status}</td>
                  <td className="px-6 py-4 space-x-2">
                    <button
                      onClick={() => navigate(`/view/${r.id}`, { state: { from: 'reports' } })}
                      className="bg-indigo-500 hover:bg-indigo-600 text-white text-sm px-4 py-2 rounded-full transition-all duration-300 transform hover:scale-105"
                    >
                      View
                    </button>
                    <button
                      disabled={!isPending}
                      onClick={() => isPending && navigate(`/submit/${r.id}`)}
                      className={`text-sm px-4 py-2 rounded-full transition-all duration-300 transform hover:scale-105 ${
                        isPending
                          ? 'bg-yellow-400 hover:bg-yellow-500 text-white'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      Edit
                    </button>
                    <button
                      disabled={!isPending}
                      onClick={() => handleDelete(r.id)}
                      className={`text-sm px-4 py-2 rounded-full transition-all duration-300 transform hover:scale-105 ${
                        isPending
                          ? 'bg-red-500 hover:bg-red-600 text-white'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
            {reports.length === 0 && (
              <tr>
                <td colSpan="7" className="px-6 py-4 text-center text-gray-500">
                  No reports found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
