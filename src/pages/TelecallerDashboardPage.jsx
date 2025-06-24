// src/pages/TelecallerDashboardPage.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useUserProfile } from '../hooks/useUserProfile';
import DateRangePicker from '../Components/DateRangePicker';
import { db } from '../firebase';
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp
} from 'firebase/firestore';

function getDateRange(type, custom) {
  const now = new Date();
  let start, end;

  if (type === 'today') {
    start = new Date(now); start.setHours(0,0,0,0);
    end   = new Date(now); end.setHours(23,59,59,999);

  } else if (type === 'yesterday') {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    start = new Date(d); start.setHours(0,0,0,0);
    end   = new Date(d); end.setHours(23,59,59,999);

  } else if (type === 'thisWeek') {
    // week starts Monday
    const day = now.getDay(), diff = (day + 6) % 7;
    start = new Date(now); start.setDate(now.getDate() - diff); start.setHours(0,0,0,0);
    end   = new Date(start); end.setDate(start.getDate() + 6);    end.setHours(23,59,59,999);

  } else if (type === 'thisMonth') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end   = new Date(now.getFullYear(), now.getMonth()+1, 0);
    start.setHours(0,0,0,0);
    end.setHours(23,59,59,999);

  } else if (type === 'custom' && custom.start && custom.end) {
    start = custom.start;
    end   = custom.end;

  } else {
    // fallback to today
    start = new Date(now); start.setHours(0,0,0,0);
    end   = new Date(now); end.setHours(23,59,59,999);
  }

  return { start, end };
}

export default function TelecallerDashboardPage() {
  const { profile, loading: authLoading } = useUserProfile();
  const navigate = useNavigate();

  const [dateType, setDateType]       = useState('today');
  const [customRange, setCustomRange] = useState({ start: null, end: null });
  const [managers, setManagers]       = useState([]);
  const [loading, setLoading]         = useState(true);

  // Compute date bounds
  const { start, end } = useMemo(
    () => getDateRange(dateType, customRange),
    [dateType, customRange]
  );
  const bStart = useMemo(() => Timestamp.fromDate(start), [start]);
  const bEnd   = useMemo(() => Timestamp.fromDate(end),   [end]);

  useEffect(() => {
    // 1) Don’t run until auth finishes
    if (authLoading) return;

    // 2) If profile is null or role isn’t telecaller, skip fetching
    if (!profile || profile.role !== 'telecaller') {
      setManagers([]); // ensure we don’t show stale data
      setLoading(false);
      return;
    }

    setLoading(true);
    (async () => {
      // 3) profile.managing is array of companyIds this telecaller manages
      const mgrCompanyIds = profile.managing || [];

      // 4) Load each manager’s user‐doc (to get their UID + name)
      const mgrUsers = [];
      for (let cid of mgrCompanyIds) {
        const uSnap = await getDocs(
          query(collection(db, 'users'), where('companyId', '==', cid))
        );
        if (!uSnap.empty) {
          const docSnap = uSnap.docs[0];
          mgrUsers.push({
            uid: docSnap.id,
            name: docSnap.data().name,
            companyId: cid,
          });
        }
      }

      // 5) For each manager, tally “own” + “subordinates’” reports broken down by status
      const enriched = await Promise.all(
        mgrUsers.map(async m => {
          // A) Manager’s own reports in [bStart..bEnd]
          const ownQ = query(
            collection(db, 'reports'),
            where('companyId', '==', m.companyId),
            where('createdAt', '>=', bStart),
            where('createdAt', '<=', bEnd)
          );
          const ownSnap = await getDocs(ownQ);

          // Count own statuses
          let ownTotal = 0, ownApproved = 0, ownPending = 0, ownRejected = 0;
          ownSnap.docs.forEach(d => {
            const status = (d.data().status || '').toLowerCase();
            ownTotal++;
            if (status === 'approved') ownApproved++;
            else if (status === 'pending') ownPending++;
            else if (status === 'rejected') ownRejected++;
          });

          // B) Find direct subordinates’ companyIds
          const subQ = query(
            collection(db, 'users'),
            where('supervisorId', '==', m.companyId)
          );
          const subSnap = await getDocs(subQ);
          const subCids = subSnap.docs.map(d => d.data().companyId).filter(Boolean);

          // C) Count subordinates’ reports in chunks of up to 10
          let subTotal = 0, subApproved = 0, subPending = 0, subRejected = 0;
          for (let i = 0; i < subCids.length; i += 10) {
            const chunk = subCids.slice(i, i + 10);
            const repsQ = query(
              collection(db, 'reports'),
              where('companyId', 'in', chunk),
              where('createdAt', '>=', bStart),
              where('createdAt', '<=', bEnd)
            );
            const repsSnap = await getDocs(repsQ);
            repsSnap.docs.forEach(d => {
              const status = (d.data().status || '').toLowerCase();
              subTotal++;
              if (status === 'approved') subApproved++;
              else if (status === 'pending') subPending++;
              else if (status === 'rejected') subRejected++;
            });
          }

          return {
            ...m,
            total:    ownTotal + subTotal,
            approved: ownApproved + subApproved,
            pending:  ownPending + subPending,
            rejected: ownRejected + subRejected
          };
        })
      );

      // 6) Sort alpha by manager name
      enriched.sort((a, b) => a.name.localeCompare(b.name));
      setManagers(enriched);
      setLoading(false);
    })();
  }, [authLoading, profile, bStart, bEnd]);

  // While waiting for auth or data, show a spinner
  if (authLoading || loading) {
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
  // If not logged in as a telecaller, redirect away
  if (!profile || profile.role !== 'telecaller') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen p-6">
      <br /><br />
     <h2 className="text-2xl font-bold mb-4 text-[#8a1ccf]">
  {profile.name} ({profile.companyId})'s Team Leads
</h2>

      <div className="mb-6 max-w-md">
        <DateRangePicker
          value={dateType}
          onChangeType={setDateType}
          customRange={customRange}
          onChangeCustom={delta => setCustomRange(cr => ({ ...cr, ...delta }))}
        />
      </div>

      <div className="overflow-x-auto bg-white rounded-2xl shadow-lg">
        <table className="min-w-full bg-white rounded-2xl">
          <thead className="bg-indigo-100">
            <tr>
              {['Name','ID','Total','Approved','Pending','Rejected',''].map(h => (
                <th key={h} className="px-6 py-3 text-left text-sm font-semibold text-indigo-600">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {managers.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-500">
                  No managers assigned.
                </td>
              </tr>
            ) : (
              managers.map((m,i) => (
                <tr key={m.uid} className={i % 2 ? 'bg-indigo-50' : 'bg-white'}>
                  <td className="px-6 py-4 font-medium text-indigo-800">{m.name}</td>
                  <td className="px-6 py-4 text-indigo-600">{m.companyId}</td>
                  <td className="px-6 py-4">{m.total}</td>
                  <td className="px-6 py-4 text-green-600">{m.approved}</td>
                  <td className="px-6 py-4 text-yellow-500">{m.pending}</td>
                  <td className="px-6 py-4 text-red-500">{m.rejected}</td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() =>
                        navigate(`/telecaller/manager-summary/${m.uid}`, { state:{ manager:m, range:{ start, end } }})
                      }
                      className="px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
