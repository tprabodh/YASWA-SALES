// src/pages/ForecastInputPage.jsx
import React, { useEffect, useState } from 'react';
import { toast, ToastContainer }      from 'react-toastify';
import { useUserProfile }             from '../hooks/useUserProfile';
import { Navigate }                   from 'react-router-dom';
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

const FORECAST_TYPES = [
  { label: 'Daily',   value: 'dailyForecast'   },
  { label: 'Weekly',  value: 'weeklyForecast'  },
  { label: 'Monthly', value: 'monthlyForecast' }
];

export default function ForecastInputPage() {
  const { profile, loading } = useUserProfile();
  const [managers, setManagers]             = useState([]);
  const [selectedManager, setSelectedManager] = useState('');
  const [forecastType, setForecastType]       = useState('');
  const [forecastValue, setForecastValue]     = useState('');

  // load managers under this telecaller
  useEffect(() => {
    if (loading || !profile) return;
    if (profile.role !== 'telecaller') return;
    (async () => {
      const mgrCids = profile.managing || [];
      if (!mgrCids.length) return setManagers([]);
      let all = [];
      for (let i = 0; i < mgrCids.length; i += 10) {
        const chunk = mgrCids.slice(i, i + 10);
        const snap = await getDocs(
          query(
            collection(db, 'users'),
            where('companyId', 'in', chunk),
            where('role', '==', 'manager')
          )
        );
        all.push(...snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
      setManagers(all);
    })();
  }, [loading, profile]);

  if (loading) return null;
  if (profile?.role !== 'telecaller') {
    return <Navigate to="/" replace />;
  }

  // helpers
  const todayTS = (() => {
    const d = new Date(); d.setHours(0,0,0,0);
    return Timestamp.fromDate(d);
  })();
  const weekStartTS = (() => {
    const d = new Date(); d.setHours(0,0,0,0);
    const wd = d.getDay(), diff = (wd + 6) % 7;
    d.setDate(d.getDate() - diff);
    return Timestamp.fromDate(d);
  })();
  const monthStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  })();

  // date comparators
  function sameDay(a, b) {
    return a.toDate().toDateString() === b.toDate().toDateString();
  }
  function sameWeek(a, b) {
    return a.toDate().getTime() === b.toDate().getTime();
  }

  const handleSubmit = async e => {
    e.preventDefault();
    if (!selectedManager)   return toast.error('Pick a manager first');
    if (!forecastType)      return toast.error('Pick forecast type');
    if (!forecastValue)     return toast.error('Enter a value');
    const val = Number(forecastValue);
    if (isNaN(val))         return toast.error('Value must be numeric');

    // 1) fetch or create the single document for this manager
    const baseQ = query(
      collection(db,'forecasts'),
      where('telecallerCompanyId','==',profile.companyId),
      where('managerId','==',selectedManager)
    );
    const snap = await getDocs(baseQ);
    let docRef, data;
    if (snap.empty) {
      // create skeleton
      const newDoc = await addDoc(collection(db,'forecasts'), {
        telecallerCompanyId: profile.companyId,
        managerId:           selectedManager,
        createdAt:           Timestamp.now(),
        dailyForecast:       null,
        weeklyForecast:      null,
        monthlyForecast:     null,
        date:      null,
        weekStart: null,
        month:     null
      });
      docRef = newDoc;
      data   = { date: null, weekStart: null, month: null };
    } else {
      const docSnap = snap.docs[0];
      docRef = docSnap.ref;
      data   = docSnap.data();
    }

    // 2) guard & update per type
    if (forecastType === 'dailyForecast') {
      if (data.date && sameDay(data.date, todayTS)) {
        return toast.error('Daily already submitted today');
      }
      await updateDoc(docRef, {
        dailyForecast: val,
        date:          todayTS,
        // keep existing weekly/monthly untouched
      });
      return toast.success('Daily forecast saved');
    }

    if (forecastType === 'weeklyForecast') {
      if (data.weekStart && sameWeek(data.weekStart, weekStartTS)) {
        return toast.error('Weekly already submitted this week');
      }
      await updateDoc(docRef, {
        weeklyForecast: val,
        weekStart:      weekStartTS
      });
      return toast.success('Weekly forecast saved');
    }

    if (forecastType === 'monthlyForecast') {
      if (data.month && data.month === monthStr) {
        return toast.error('Monthly already submitted this month');
      }
      await updateDoc(docRef, {
        monthlyForecast: val,
        month:           monthStr
      });
      return toast.success('Monthly forecast saved');
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto">
      <ToastContainer />
      <h2 className="text-2xl font-bold mb-4">Enter Forecast</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Manager */}
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
                {m.name} ({m.companyId})
              </option>
            ))}
          </select>
        </div>

        {/* Forecast Type */}
        <div>
          <label className="block mb-1 font-medium">Forecast Type</label>
          <select
            value={forecastType}
            onChange={e => setForecastType(e.target.value)}
            className="w-full border p-2 rounded"
          >
            <option value="">-- Select Type --</option>
            {FORECAST_TYPES.map(f => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        {/* Value */}
        <div>
          <label className="block mb-1 font-medium">Value</label>
          <input
            type="number"
            value={forecastValue}
            onChange={e => setForecastValue(e.target.value)}
            className="w-full border p-2 rounded"
          />
        </div>

        <button
          type="submit"
          className="w-full py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          Submit
        </button>
      </form>
    </div>
  );
}
