// src/pages/ForecastPage.jsx
import React, { useEffect, useState } from 'react';
import { Navigate }                from 'react-router-dom';
import { useUserProfile }          from '../hooks/useUserProfile';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { db }                      from '../firebase';

export default function ForecastPage() {
  const { profile, loading } = useUserProfile();
  const [data,        setData]        = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // Count actual reports in [startTS,endTS]
  async function countInRange(cids, startTS, endTS) {
    const snap = await getDocs(
      query(
        collection(db,'reports'),
        where('companyId','in', cids),
        where('createdAt','>=', startTS),
        where('createdAt','<=', endTS)
      )
    );
    return snap.size;
  }

 useEffect(() => {
  // 1) Don’t run until auth loading finishes
  if (loading) 
    return ;
  

  // 2) If we've logged out or are not a telecaller, bail early
  if (!profile || profile.role !== 'telecaller') return;

  // 3) Now safe to fetch data
  setLoadingData(true);
  (async () => {
    const teleCid = profile.companyId;

    // Load telecaller’s own user record to get .managing[]
    const teleSnap = await getDocs(
      query(collection(db,'users'), where('companyId','==', teleCid))
    );
    if (teleSnap.empty) {
      setData([]);
      setLoadingData(false);
      return;
    }
    const managerCompanyIds = teleSnap.docs[0].data().managing || [];

    // Fetch full manager docs in chunks of 10
    const managerDocs = [];
    for (let i = 0; i < managerCompanyIds.length; i += 10) {
      const chunk = managerCompanyIds.slice(i, i + 10);
      const mSnap = await getDocs(
        query(
          collection(db,'users'),
          where('companyId','in', chunk),
          where('role','==','manager')
        )
      );
      mSnap.docs.forEach(d => {
        const dd = d.data();
        managerDocs.push({
          uid:           d.id,
          companyId:     dd.companyId,
          name:          dd.name,
          mobileNumber:  dd.mobileNumber,
          subordinates:  dd.subordinates || []
        });
      });
    }

    // Build time windows
    const now = new Date();
    const dayStart = new Date(now); dayStart.setHours(0,0,0,0);
    const dayEnd   = new Date(now); dayEnd.setHours(23,59,59,999);
    const todayTS  = Timestamp.fromDate(dayStart);

    const wd = dayStart.getDay(), diff = (wd + 6) % 7;
    const weekStartDate = new Date(dayStart);
    weekStartDate.setDate(weekStartDate.getDate() - diff);
    weekStartDate.setHours(0,0,0,0);
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    weekEndDate.setHours(23,59,59,999);
    const weekStartTS = Timestamp.fromDate(weekStartDate);

    const monthStr        = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const monthStartDate  = new Date(now.getFullYear(), now.getMonth(), 1);
    monthStartDate.setHours(0,0,0,0);
    const monthEndDate    = new Date(now.getFullYear(), now.getMonth()+1, 0);
    monthEndDate.setHours(23,59,59,999);

    // Helper to count actuals
    async function countInRange(cids, startTS, endTS) {
      const snap = await getDocs(
        query(
          collection(db,'reports'),
          where('companyId','in', cids),
          where('createdAt','>=', startTS),
          where('createdAt','<=', endTS)
        )
      );
      return snap.size;
    }

    // Assemble rows
    const rows = [];
    let idx = 1;
    for (let mgr of managerDocs) {
      const cids = [mgr.companyId, ...mgr.subordinates];

      // Fetch all forecasts once per manager
      const fSnap = await getDocs(
        query(
          collection(db,'forecasts'),
          where('telecallerCompanyId','==',teleCid),
          where('managerId','==',           mgr.uid)
        )
      );

      let dailyForecast   = 0;
      let weeklyForecast  = 0;
      let monthlyForecast = 0;
      fSnap.docs.forEach(d => {
        const f = d.data();
        if (f.date?.toDate().getTime()   >= dayStart.getTime() && f.date?.toDate().getTime()   <= dayEnd.getTime())   {
          dailyForecast   = f.dailyForecast   || 0;
        }
        if (f.weekStart?.toDate().getTime() === weekStartDate.getTime()) {
          weeklyForecast  = f.weeklyForecast  || 0;
        }
        if (f.month === monthStr) {
          monthlyForecast = f.monthlyForecast || 0;
        }
      });

      const dailyActual   = await countInRange(cids, todayTS,               Timestamp.fromDate(dayEnd));
      const weeklyActual  = await countInRange(cids, weekStartTS,          Timestamp.fromDate(weekEndDate));
      const monthlyActual = await countInRange(cids, Timestamp.fromDate(monthStartDate), Timestamp.fromDate(monthEndDate));

      rows.push({
        idx,
        mgrName:         `${mgr.name} (${mgr.companyId})`,
        mgrPhone:        mgr.mobileNumber || '—',
        dailyForecast,
        dailyActual,
        weeklyForecast,
        weeklyActual,
        monthlyForecast,
        monthlyActual
      });
      idx++;
    }

    setData(rows);
    setLoadingData(false);
  })();
}, [profile, loading]);


  

  return (
    <div className="p-6">
        <br /><br />
      <h2 className="text-2xl font-extrabold text-[#8a1ccf] mb-4">Monthly Summary</h2>
      <div className="overflow-x-auto bg-white rounded shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              {[
                'S.no','Team Lead','Phone',
                "Today's Forecast","Today's Actual",
                "This Week's Forecast","This Week's Actual",
                'Monthly Forecast','Monthly Actual'
              ].map(h => (
                <th key={h}
                    className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="bg-white divide-y divide-gray-200">
            {data.map(r => (
              <tr key={r.idx}>
                <td className="px-4 py-2">{r.idx}</td>
                <td className="px-4 py-2">{r.mgrName}</td>
                <td className="px-4 py-2">{r.mgrPhone}</td>
                <td className="px-4 py-2">{r.dailyForecast}</td>
                <td className="px-4 py-2">{r.dailyActual}</td>
                <td className="px-4 py-2">{r.weeklyForecast}</td>
                <td className="px-4 py-2">{r.weeklyActual}</td>
                <td className="px-4 py-2">{r.monthlyForecast}</td>
                <td className="px-4 py-2">{r.monthlyActual}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
