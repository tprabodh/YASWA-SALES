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

  // Compute start/end timestamps
  const computeRange = () => {
    const now = new Date();
    let start = null, end = null;
    switch (rangeType) {
      case 'today':
        start = new Date(now.setHours(0, 0, 0, 0));
        end = new Date(now.setHours(23, 59, 59, 999));
        break;
      case 'yesterday': {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        start = new Date(d.setHours(0, 0, 0, 0));
        end = new Date(d.setHours(23, 59, 59, 999));
        break;
      }
      case 'thisWeek': {
        const d = new Date();
        const day = d.getDay();
        const diffStart = d.getDate() - day + (day === 0 ? -6 : 1);
        start = new Date(d.setDate(diffStart)); start.setHours(0, 0, 0, 0);
        end = new Date(); end.setHours(23, 59, 59, 999);
        break;
      }
      case 'thisMonth': {
        const d = new Date();
        start = new Date(d.getFullYear(), d.getMonth(), 1);
        end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      }
      case 'custom':
        start = customRange.start;
        end = customRange.end;
        break;
      default:
    }
    return {
      start: start ? Timestamp.fromDate(start) : null,
      end: end ? Timestamp.fromDate(end) : null
    };
  };

  useEffect(() => {
    if (authLoading) return;
    // allow true BH or admin passing bhCompanyIdFromState
    if (profile?.role !== 'businessHead' && !bhCompanyIdFromState) return;

    const { start, end } = computeRange();
    if (!start || !end) return;

    (async () => {
      setLoading(true);

      // choose BH ID and telecallers
      let bhCompanyId = profile.companyId;
      let teleCompIds = profile.telecallers || [];
      if (bhCompanyIdFromState) {
        bhCompanyId = bhCompanyIdFromState;
        const bhSnap = await getDocs(
          query(collection(db, 'users'), where('companyId', '==', bhCompanyId))
        );
        if (!bhSnap.empty) {
          teleCompIds = bhSnap.docs[0].data().telecallers || [];
        }
      }

      const summary = [];
      employeeMapRef.current = {};

      for (let tcCompId of teleCompIds) {
        // fetch telecaller’s user document
        const tcSnap = await getDocs(
          query(collection(db, 'users'), where('companyId', '==', tcCompId))
        );
        if (tcSnap.empty) continue;
        const tcData = tcSnap.docs[0].data();
        const teleName = tcData.name;

        // managers under this telecaller
        const managerCompIds = tcData.managing || [];
        let employeeCompIds = [];

        // --- FIRST: count each manager’s OWN reports in this date-range ---
        let approved = 0, pending = 0, rejected = 0;
        for (let mCid of managerCompIds) {
          // Query manager’s own reports (companyId == mCid) in [start..end]
          const mgrRptQ = query(
            collection(db, 'reports'),
            where('companyId', '==', mCid),
            where('createdAt', '>=', start),
            where('createdAt', '<=', end)
          );
          const mgrRptSnap = await getDocs(mgrRptQ);
          mgrRptSnap.docs.forEach(d => {
            const st = d.data().status?.toLowerCase();
            if (st === 'approved') approved++;
            else if (st === 'pending') pending++;
            else if (st === 'rejected') rejected++;
          });
        }

        // Now gather all subordinates’ IDs and store manager/tele metadata
        for (let i = 0; i < managerCompIds.length; i += 10) {
          const chunk = managerCompIds.slice(i, i + 10);
          const mSnap = await getDocs(
            query(collection(db, 'users'), where('companyId', 'in', chunk))
          );
          mSnap.docs.forEach(d => {
            const m = d.data();
            const mgrCompId = m.companyId;
            const mgrName = m.name;
            ;(m.subordinates || []).forEach(empCid => {
              employeeCompIds.push(empCid);
              employeeMapRef.current[empCid] = {
                managerCompId: mgrCompId,
                managerName: mgrName,
                teleCompId: tcCompId,
                teleName
              };
            });
          });
        }

        // --- SECOND: count subordinates’ reports in this date-range ---
        for (let i = 0; i < employeeCompIds.length; i += 10) {
          const chunk = employeeCompIds.slice(i, i + 10);
          const rSnap = await getDocs(
            query(collection(db, 'reports'),
              where('companyId', 'in', chunk),
              where('createdAt', '>=', start),
              where('createdAt', '<=', end)
            )
          );
          rSnap.docs.forEach(d => {
            const st = d.data().status?.toLowerCase();
            if (st === 'approved') approved++;
            else if (st === 'pending') pending++;
            else if (st === 'rejected') rejected++;
          });
        }

        const total = approved + pending + rejected;
        summary.push({
          teleName,
          approved,
          pending,
          rejected,
          total,
          incentive: total * 100
        });
      }

      setData(summary);
      setLoading(false);
    })();
  }, [authLoading, profile, bhCompanyIdFromState, rangeType, customRange]);

  // render guards
  if (authLoading || loading) {
    return <p className="p-6">Loading Business Head View…</p>;
  }
  if (profile?.role !== 'businessHead' && !bhCompanyIdFromState) {
    return <Navigate to="/" replace />;
  }

  const handleDownload = async () => {
    const { start, end } = computeRange();
    const rows = [];
    const teleCompIds = profile.telecallers || [];
    for (let tcCompId of teleCompIds) {
      const tcSnap = await getDocs(
        query(collection(db, 'users'), where('companyId', '==', tcCompId))
      );
      if (tcSnap.empty) continue;
      const managerCompIds = tcSnap.docs[0].data().managing || [];
      let employeeCompIds = [];
      managerCompIds.forEach(mgrCid => {
        const mData = tcSnap.docs[0].data();
        ;(mData.subordinates || []).forEach(empCid => {
          employeeCompIds.push(empCid);
        });
      });

      for (let i = 0; i < employeeCompIds.length; i += 10) {
        const chunk = employeeCompIds.slice(i, i + 10);
        const rSnap = await getDocs(
          query(collection(db, 'reports'),
            where('companyId', 'in', chunk),
            where('createdAt', '>=', start),
            where('createdAt', '<=', end)
          )
        );
        rSnap.docs.forEach(d => {
          const rpt = d.data();
          const empCid = rpt.companyId;
          const meta = employeeMapRef.current[empCid] || {};
          rows.push({
            reportId: d.id,
            studentName: rpt.studentName,
            studentPhone: rpt.studentPhone,
            course: rpt.course,
            status: rpt.status,
            createdAt: rpt.createdAt.toDate().toLocaleString(),
            employeeCompanyId: empCid,
            managerCompanyId: meta.managerCompId || '',
            managerName: meta.managerName || '',
            telecallerCompanyId: meta.teleCompId || '',
            telecallerName: meta.teleName || '',
            incentive: 100
          });
        });
      }
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reports');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'businesshead_reports.xlsx');
  };

  return (
    <div className="p-6">
      <br />
      <br />
      <h2 className="text-2xl font-bold mb-4">
  {profile.name} ({profile.companyId})'s Dashboard
</h2>
      <DateRangePicker
        value={rangeType}
        onChangeType={setRangeType}
        customRange={customRange}
        onChangeCustom={setCustomRange}
      />
      <button
        onClick={handleDownload}
        className="mt-4 mb-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Download Reports
      </button>
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              {['S.No','Manager-Sales','Approved','Pending','Rejected','Total'].map(h => (
                <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((r, i) => (
              <tr key={i} className={i % 2 ? 'bg-gray-50' : ''}>
                <td className="px-6 py-3 text-sm text-gray-800">{i + 1}</td>
                <td className="px-6 py-3 text-sm text-gray-800">{r.teleName}</td>
                <td className="px-6 py-3 text-sm text-gray-800">{r.approved}</td>
                <td className="px-6 py-3 text-sm text-gray-800">{r.pending}</td>
                <td className="px-6 py-3 text-sm text-gray-800">{r.rejected}</td>
                <td className="px-6 py-3 text-sm text-gray-800">{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
