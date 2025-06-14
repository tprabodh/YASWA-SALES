// src/pages/BusinessHeadView.jsx
import React, { useEffect, useState, useRef } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { useUserProfile } from '../hooks/useUserProfile';
import DateRangePicker from '../Components/DateRangePicker';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

export default function BusinessHeadView() {
  const { profile, loading: authLoading } = useUserProfile();
  const { state } = useLocation();
  const bhCompanyIdFromState = state?.bhCompanyId;
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const employeeMapRef = useRef({});

  // Date range picker state
  const [rangeType, setRangeType] = useState('today');
  const [customRange, setCustomRange] = useState({ start: null, end: null });

  // Normalize preset + custom into Firestore Timestamps
  function getDateRange(type, custom) {
    const now = new Date();
    let start, end;

    if (type === 'today') {
      start = new Date(now); start.setHours(0,0,0,0);
      end   = new Date(now); end.setHours(23,59,59,999);
    } else if (type === 'yesterday') {
      const d = new Date(now); d.setDate(d.getDate()-1);
      start = new Date(d); start.setHours(0,0,0,0);
      end   = new Date(d); end.setHours(23,59,59,999);
    } else if (type === 'thisWeek') {
      const day = now.getDay(), diff = (day+6)%7;
      const mon = new Date(now);
      mon.setDate(now.getDate() - diff);
      start = new Date(mon); start.setHours(0,0,0,0);
      end   = new Date(mon);
      end.setDate(mon.getDate() + 6);
      end.setHours(23,59,59,999);
    } else if (type === 'thisMonth') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end   = new Date(now.getFullYear(), now.getMonth()+1, 0);
      start.setHours(0,0,0,0);
      end.setHours(23,59,59,999);
    } else if (
      type === 'custom' &&
      custom.start instanceof Date &&
      custom.end   instanceof Date
    ) {
      start = custom.start;
      end   = custom.end;
    } else {
      start = new Date(0);
      end   = now;
    }

    return {
      start: Timestamp.fromDate(start),
      end:   Timestamp.fromDate(end)
    };
  }

  useEffect(() => {
    if (authLoading) return;
    if (profile?.role !== 'businessHead' && !bhCompanyIdFromState) return;

    const { start, end } = getDateRange(rangeType, customRange);

    (async () => {
      setLoading(true);
      let bhId = profile.companyId;
      let telecallers = profile.telecallers || [];

      if (bhCompanyIdFromState) {
        bhId = bhCompanyIdFromState;
        const bhSnap = await getDocs(
          query(collection(db,'users'), where('companyId','==', bhId))
        );
        if (!bhSnap.empty) {
          telecallers = bhSnap.docs[0].data().telecallers || [];
        }
      }

      const summary = [];
      employeeMapRef.current = {};

      for (let tcCid of telecallers) {
        const tcSnap = await getDocs(
          query(collection(db,'users'), where('companyId','==', tcCid))
        );
        if (tcSnap.empty) continue;
        const tcData = tcSnap.docs[0].data();
        const teleName = tcData.name;
        const managerCids = tcData.managing || [];

        let approved=0, pending=0, rejected=0;

        // count managers’ own reports
        for (let mCid of managerCids) {
          const rptSnap = await getDocs(
            query(
              collection(db,'reports'),
              where('companyId','==', mCid),
              where('createdAt','>=', start),
              where('createdAt','<=', end)
            )
          );
          rptSnap.docs.forEach(d => {
            const st = d.data().status?.toLowerCase();
            if (st==='approved') approved++;
            else if (st==='pending') pending++;
            else if (st==='rejected') rejected++;
          });
        }

        // gather employees under each manager
        const empCids = [];
        for (let i = 0; i < managerCids.length; i += 10) {
          const chunk = managerCids.slice(i, i + 10);
          const userSnap = await getDocs(
            query(collection(db,'users'), where('companyId','in', chunk))
          );
          userSnap.docs.forEach(d => {
            const u = d.data();
            const mgrId   = u.companyId;
            const mgrName = u.name;
            (u.subordinates || []).forEach(empCid => {
              empCids.push(empCid);
              employeeMapRef.current[empCid] = {
                managerCompId: mgrId,
                managerName:   mgrName,
                teleCompId:    tcCid,
                teleName
              };
            });
          });
        }

        // count subordinates’ reports
        for (let i = 0; i < empCids.length; i += 10) {
          const chunk = empCids.slice(i, i + 10);
          const rptSnap = await getDocs(
            query(
              collection(db,'reports'),
              where('companyId','in', chunk),
              where('createdAt','>=', start),
              where('createdAt','<=', end)
            )
          );
          rptSnap.docs.forEach(d => {
            const st = d.data().status?.toLowerCase();
            if (st==='approved') approved++;
            else if (st==='pending') pending++;
            else if (st==='rejected') rejected++;
          });
        }

        summary.push({
          teleName,
          approved,
          pending,
          rejected,
          total: approved + pending + rejected,
          incentive: (approved + pending + rejected) * 100
        });
      }

      setData(summary);
      setLoading(false);
    })();
  }, [
    authLoading,
    profile,
    bhCompanyIdFromState,
    rangeType,
    customRange
  ]);

  if (authLoading || loading) {
    return <p className="p-6">Loading Business Head View…</p>;
  }
  if (profile?.role !== 'businessHead' && !bhCompanyIdFromState) {
    return <Navigate to="/" replace />;
  }

  const handleDownload = async () => {
    const { start, end } = getDateRange(rangeType, customRange);
    const rows = [];

    for (let tcCid of (profile.telecallers||[])) {
      const tcSnap = await getDocs(
        query(collection(db,'users'), where('companyId','==', tcCid))
      );
      if (tcSnap.empty) continue;
      const managerCids = tcSnap.docs[0].data().managing || [];
      const empCids = [];

      managerCids.forEach(mgrCid => {
        const u = tcSnap.docs[0].data();
        (u.subordinates||[]).forEach(empCid => empCids.push(empCid));
      });

      for (let i = 0; i < empCids.length; i += 10) {
        const chunk = empCids.slice(i, i + 10);
        const rptSnap = await getDocs(
          query(
            collection(db,'reports'),
            where('companyId','in', chunk),
            where('createdAt','>=', start),
            where('createdAt','<=', end)
          )
        );
        rptSnap.docs.forEach(d => {
          const rpt = d.data();
          const meta = employeeMapRef.current[rpt.companyId] || {};
          rows.push({
            reportId: d.id,
            studentName:       rpt.studentName,
            studentPhone:      rpt.studentPhone,
            course:            rpt.course,
            status:            rpt.status,
            createdAt:         rpt.createdAt.toDate().toLocaleString(),
            employeeCompanyId: rpt.companyId,
            managerCompanyId:  meta.managerCompId || '',
            managerName:       meta.managerName  || '',
            telecallerCompanyId: meta.teleCompId || '',
            telecallerName:      meta.teleName   || '',
            incentive:           100
          });
        });
      }
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reports');
    const blob = new Blob([XLSX.write(wb,{bookType:'xlsx',type:'array'})], {
      type:'application/octet-stream'
    });
    saveAs(blob,'businesshead_reports.xlsx');
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">
        {profile.name} ({profile.companyId})’s Dashboard
      </h2>

      <div className="mb-4 max-w-md">
        <DateRangePicker
          value={rangeType}
          onChangeType={setRangeType}
          customRange={customRange}
          onChangeCustom={delta =>
            setCustomRange(prev => ({ ...prev, ...delta }))
          }
        />
      </div>

      <button
        onClick={handleDownload}
        className="mb-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Download Reports
      </button>

      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              {['S.No','Manager-Sales','Approved','Pending','Rejected','Total'].map(h => (
                <th
                  key={h}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((r,i) => (
              <tr key={i} className={i%2 ? 'bg-gray-50' : ''}>
                <td className="px-6 py-3 text-sm text-gray-800">{i+1}</td>
                <td className="px-6 py-3 text-sm text-gray-800">{r.teleName}</td>
                <td className="px-6 py-3 text-sm text-green-600 font-semibold">{r.approved}</td>
                <td className="px-6 py-3 text-sm text-yellow-600 font-semibold">{r.pending}</td>
                <td className="px-6 py-3 text-sm text-red-600 font-semibold">{r.rejected}</td>
                <td className="px-6 py-3 text-sm text-gray-800">{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
