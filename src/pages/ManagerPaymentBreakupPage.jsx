// src/pages/ManagerPaymentBreakupPage.jsx

import React, { useEffect, useState } from 'react';
import {
  Navigate,
  useLocation,
  useNavigate
} from 'react-router-dom';
import { useUserProfile } from '../hooks/useUserProfile';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';

export default function ManagerPaymentBreakupPage() {
  const { profile, loading: authLoading } = useUserProfile();
  const { state }       = useLocation();
  const navigate        = useNavigate();
  const run             = state?.run;
  const companyId       = profile?.companyId;

  const [breakup, setBreakup] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pull dateRange out of run so we can reference it below
  const dateRange = run?.dateRange;

  // Helpers to convert structured‐clone’d Timestamps back:
  function toTimestamp(val) {
    if (val instanceof Timestamp) return val;
    if (val?.seconds != null) {
      return Timestamp.fromMillis(val.seconds * 1000);
    }
    return null;
  }
  function toDate(val) {
    if (val instanceof Timestamp) return val.toDate();
    if (val?.seconds != null) {
      return new Date(val.seconds * 1000);
    }
    return new Date(val);
  }

  useEffect(() => {
    console.log('ManagerPaymentBreakupPage useEffect start');
    if (authLoading) {
      console.log('Still authLoading, exiting');
      return;
    }
    if (!run || profile?.role !== 'manager') {
      console.log('No run or not manager, exiting');
      setLoading(false);
      return;
    }

    console.log('Loaded run:', run);
    console.log('Manager companyId:', companyId);

    const rawStart = dateRange?.start;
    const rawEnd   = dateRange?.end;

    const startTS = toTimestamp(rawStart);
    const endTS   = toTimestamp(rawEnd);

    console.log('startTS:', startTS, 'endTS:', endTS);

    if (!startTS || !endTS) {
      console.warn('Invalid dateRange on run:', run);
      setLoading(false);
      return;
    }

    (async () => {
      const rows = [];
      const subordinateIds = run.subordinateIds || [];
      console.log('Subordinate IDs from run:', subordinateIds);

      for (let cid of subordinateIds) {
        console.log(`Querying reports for subordinate ${cid}`);
        // Removed managerId filter—just count by companyId, date, paymentStatus, managerCommission
        const rptQ = query(
          collection(db, 'reports'),
          where('companyId',        '==', cid),
          where('createdAt',        '>=', startTS),
          where('createdAt',        '<=', endTS),
          where('paymentStatus',    '==','paid'),
          where('managerCommission','==','paid')
        );
        const snap = await getDocs(rptQ);
        console.log(`Found ${snap.size} paid reports for ${cid}`);

        // Look up that subordinate’s name
        const uSnap = await getDocs(
          query(
            collection(db, 'users'),
            where('companyId', '==', cid)
          )
        );
        const name = uSnap.empty ? '—' : uSnap.docs[0].data().name;
        console.log(`Subordinate ${cid} name: ${name}`);

        rows.push({ cid, name, count: snap.size });
      }

      console.log('Final breakup rows:', rows);
      setBreakup(rows);
      setLoading(false);
    })();
  }, [authLoading, profile, run, companyId, dateRange]);

  // Loading / auth guards
  if (authLoading || loading) {
    return <p className="p-6">Loading…</p>;
  }
  if (profile?.role !== 'manager' || !run) {
    return <Navigate to="/" replace />;
  }

  // Convert run.dateRange → human‐readable strings
  const startDt = toDate(dateRange.start).toLocaleDateString();
  const endDt   = toDate(dateRange.end).toLocaleDateString();

  return (
    <div className="p-6">
      <br /><br />
      <h2 className="text-2xl font-bold mb-4">
        Breakdown for period {startDt} – {endDt}
      </h2>

      <table className="min-w-full bg-white shadow rounded">
        <thead className="bg-gray-100">
          <tr>
            {['Consultant ID','Name','Total Reports','My Incentive','Actions'].map(h => (
              <th
                key={h}
                className="p-2 text-left text-xs text-gray-600 uppercase"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {breakup.length ? breakup.map((r, i) => (
            <tr key={r.cid} className={i % 2 ? 'bg-gray-50' : ''}>
              <td className="p-2">{r.cid}</td>
              <td className="p-2">{r.name}</td>
              <td className="p-2">{r.count}</td>
              <td className="p-2">₹{r.count * 500}</td>
              <td className="p-2">
                <button
                  className="px-2 py-1 bg-indigo-500 text-white rounded"
                  onClick={() => {
                    navigate('/manager/paid-reports', {
                      state: {
                        range: dateRange,
                        subordinateCid: r.cid
                      }
                    });
                  }}
                >
                  View Reports
                </button>
              </td>
            </tr>
          )) : (
            <tr>
              <td colSpan={5} className="p-4 text-center text-gray-500">
                No paid reports found in that date range.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
