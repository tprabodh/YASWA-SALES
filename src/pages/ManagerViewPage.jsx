// src/pages/ManagerViewPage.jsx
import React, { useEffect, useState } from 'react';
import { useUserProfile } from '../hooks/useUserProfile';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { useNavigate } from 'react-router-dom';

export default function ManagerViewPage() {
  const { profile, loading } = useUserProfile();
  const [reports, setReports] = useState([]);
  const navigate = useNavigate();

  // 1) Load reports for all subordinates
  useEffect(() => {
    if (loading || !profile?.subordinates?.length) return;

    (async () => {
      // Firestore “in” queries require non-empty array and <= 10 items
      const subs = profile.subordinates;
      const q = query(
        collection(db, 'reports'),
        where('companyId', 'in', subs)
      );
      const snap = await getDocs(q);
      setReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    })();
  }, [loading, profile]);

  // 2) Mark Paid handler
 const handleManagerPaid = async () => {
    // a) find all approved reports (case‑insensitive)
    const approved = reports.filter(r =>
      typeof r.status === 'string' && r.status.toLowerCase() === 'approved'
    );
    if (!approved.length) {
      alert('No approved reports to mark paid.');
      return;
    }

    // b) update each approved report
    await Promise.all(
      approved.map(r =>
        updateDoc(doc(db, 'reports', r.id), { managerCommission: 'paid' })
      )
    );

    // c) build Excel payload
    const data = approved.map(r => ({
      'Student Name':        r.studentName,
      'Student Phone':       r.studentPhone,
      'Student Email':       r.studentEmail,
      'WhatsApp Number':     r.whatsappNumber,
      'Grade':               r.grade,
      'Course Purchased':    r.course,
      'Status':              r.status,
      'Created At':          r.createdAt?.toDate().toLocaleString() || '',
      'Employee Company ID': r.companyId,
      'Manager Commission':  'paid',
      'Commission (₹)':      500,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Manager_Payouts');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

    saveAs(
      new Blob([wbout], { type: 'application/octet-stream' }),
      `manager_${profile.companyId}_payouts.xlsx`
    );

    // d) update local state so the table reflects the new commission flag
    setReports(prev =>
      prev.map(r =>
        (typeof r.status === 'string' && r.status.toLowerCase() === 'approved')
          ? { ...r, managerCommission: 'paid' }
          : r
      )
    );
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  return (
    // add pt-16 so content sits below your fixed TopBar
    <div className="min-h-screen bg-gray-100 p-6 pt-18">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">
            Reports Managed by You
          </h2>
        </div>

        {reports.length === 0 ? (
          <p className="text-gray-600">No reports found.</p>
        ) : (
          <div className="overflow-x-auto bg-white rounded-lg shadow">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['Student', 'Grade', 'Course', 'Status', 'Commission', 'View'].map(hdr => (
                    <th
                      key={hdr}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide"
                    >
                      {hdr}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reports.map((r, i) => (
                  <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 text-gray-800">{r.studentName}</td>
                    <td className="px-6 py-4 text-gray-800">{r.grade}</td>
                    <td className="px-6 py-4 text-gray-800">{r.course}</td>
                    <td className="px-6 py-4 text-gray-800">{r.status}</td>
                    <td className="px-6 py-4 text-gray-800">
                      {r.managerCommission === 'paid' ? 'Paid' : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() =>
                          navigate(`/view/${r.id}`, { state: { from: 'manager' } })
                        }
                        className="px-3 py-1 bg-[#8a1ccf] text-white rounded hover:bg-[#7a1bbf] transition text-sm"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
