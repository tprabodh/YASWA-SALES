// src/pages/ForecastInputPage.jsx
import React, { useEffect, useState } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import { useUserProfile }       from '../hooks/useUserProfile';
import { Navigate }             from 'react-router-dom';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';

export default function ForecastInputPage() {
  const { profile, loading } = useUserProfile();
  const [managers, setManagers]           = useState([]);
  const [selectedManager, setSelectedManager] = useState('');
  const [daily,   setDaily]   = useState('');
  const [weekly,  setWeekly]  = useState('');
  const [monthly, setMonthly] = useState('');

  // Fetch managers once telecaller is known
  useEffect(() => {
    if (loading || !profile) return;
    if (profile.role !== 'telecaller') return;

    (async () => {
      const mgrCompIds = profile.managing || [];
      if (!mgrCompIds.length) { setManagers([]); return; }

      const chunks = [];
      for (let i = 0; i < mgrCompIds.length; i += 10) {
        chunks.push(mgrCompIds.slice(i, i + 10));
      }

      const fetched = [];
      for (const chunk of chunks) {
        const snap = await getDocs(
          query(
            collection(db, 'users'),
            where('companyId','in',chunk),
            where('role','==','manager')
          )
        );
        snap.docs.forEach(d => fetched.push({ id: d.id, ...d.data() }));
      }
      setManagers(fetched);
    })();
  }, [profile, loading]);

  // Redirect non-telecallers
  if (loading) return null;
  if (profile?.role !== 'telecaller') {
    return <Navigate to="/" replace />;
  }

  // Helpers to compute period markers
  const getTodayTS = () => {
    const now = new Date(); now.setHours(0,0,0,0);
    return Timestamp.fromDate(now);
  };
  const getWeekStartTS = () => {
    const now = new Date(); now.setHours(0,0,0,0);
    const wd = now.getDay(), diff = (wd+6)%7;
    const monday = new Date(now);
    monday.setDate(monday.getDate() - diff);
    monday.setHours(0,0,0,0);
    return Timestamp.fromDate(monday);
  };
  const getMonthStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  };

  // Upsert helper for a single field
  async function upsertForecast(filterQuery, fields) {
    const snap = await getDocs(filterQuery);
    if (snap.empty) {
      await addDoc(collection(db,'forecasts'), {
        telecallerCompanyId: profile.companyId,
        managerId:           selectedManager,
        date:                getTodayTS(),
        weekStart:           getWeekStartTS(),
        month:               getMonthStr(),
        createdAt:           Timestamp.now(),
        // initialize all three so the doc is uniform
        dailyForecast:       Number(daily),
        weeklyForecast:      Number(weekly),
        monthlyForecast:     Number(monthly),
        ...fields
      });
    } else {
      const ref = snap.docs[0].ref;
      await updateDoc(ref, fields);
    }
  }

  const handleDaily = async () => {
    if (!selectedManager) return toast.error('Pick a manager first');
    const todayTS = getTodayTS();
    const q = query(
      collection(db,'forecasts'),
      where('telecallerCompanyId','==',profile.companyId),
      where('managerId','==',selectedManager),
      where('date','==',todayTS)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      return toast.error('Daily forecast already submitted today');
    }
    await upsertForecast(q, { date: todayTS, dailyForecast: Number(daily) });
    toast.success('Daily forecast saved');
  };

  const handleWeekly = async () => {
    if (!selectedManager) return toast.error('Pick a manager first');
    const weekStartTS = getWeekStartTS();
    const q = query(
      collection(db,'forecasts'),
      where('telecallerCompanyId','==',profile.companyId),
      where('managerId','==',selectedManager),
      where('weekStart','==',weekStartTS)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      return toast.error('Weekly forecast already submitted this week');
    }
    await upsertForecast(q, { weekStart: weekStartTS, weeklyForecast: Number(weekly) });
    toast.success('Weekly forecast saved');
  };

  const handleMonthly = async () => {
    if (!selectedManager) return toast.error('Pick a manager first');
    const monthStr = getMonthStr();
    const q = query(
      collection(db,'forecasts'),
      where('telecallerCompanyId','==',profile.companyId),
      where('managerId','==',selectedManager),
      where('month','==',monthStr)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      return toast.error('Monthly forecast already submitted this month');
    }
    await upsertForecast(q, { month: monthStr, monthlyForecast: Number(monthly) });
    toast.success('Monthly forecast saved');
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
        <br /><br />
      <ToastContainer
        position="top-center" autoClose={3000} hideProgressBar={false}
        newestOnTop={false} closeOnClick rtl={false}
        pauseOnFocusLoss draggable pauseOnHover
      />

      <h2 className="text-2xl font-bold mb-4">Enter Forecast</h2>
      <div className="space-y-4">
        <div>
          <label className="block mb-1 font-medium">Select Manager</label>
          <select
            value={selectedManager}
            onChange={e => setSelectedManager(e.target.value)}
            className="w-full border p-2 rounded"
          >
            <option value="">-- Select Manager --</option>
            {managers.map(m => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.mobileNumber})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block mb-1 font-medium">Daily Forecast</label>
          <input
            type="number"
            value={daily}
            onChange={e => setDaily(e.target.value)}
            className="w-full border rounded p-2"
          />
          <button
            onClick={handleDaily}
            className="mt-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Submit Daily
          </button>
        </div>

        <div>
          <label className="block mb-1 font-medium">Weekly Forecast</label>
          <input
            type="number"
            value={weekly}
            onChange={e => setWeekly(e.target.value)}
            className="w-full border rounded p-2"
          />
          <button
            onClick={handleWeekly}
            className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            Submit Weekly
          </button>
        </div>

        <div>
          <label className="block mb-1 font-medium">Monthly Forecast</label>
          <input
            type="number"
            value={monthly}
            onChange={e => setMonthly(e.target.value)}
            className="w-full border rounded p-2"
          />
          <button
            onClick={handleMonthly}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Submit Monthly
          </button>
        </div>
      </div>
    </div>
  );
}
