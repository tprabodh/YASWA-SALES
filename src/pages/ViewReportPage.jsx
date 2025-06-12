// src/pages/ViewReportPage.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

export default function ViewReportPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const backTo = location.state?.from === 'admin' ? '/admin' : '/reports';

  const [report, setReport] = useState(null);
  const [employeeName, setEmployeeName] = useState('—');
  const [companyId, setCompanyId] = useState('');

  useEffect(() => {
    if (!id) return;

    async function loadData() {
      // 1) Fetch the report
      const reportSnap = await getDoc(doc(db, 'reports', id));
      if (!reportSnap.exists()) {
        alert('Report not found');
        return navigate(backTo, { replace: true });
      }
      const data = reportSnap.data();
      setReport(data);

      // 2) Look up the user who has this companyId
      if (data.companyId) {
        setCompanyId(data.companyId);
        const q = query(
          collection(db, 'users'),
          where('companyId', '==', data.companyId)
        );
        const usersSnap = await getDocs(q);
        if (!usersSnap.empty) {
          setEmployeeName(usersSnap.docs[0].data().name);
        }
      }
    }

    loadData();
  }, [id, backTo, navigate]);

  if (!report) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-500 text-lg">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* Header with arbitrary background */}
        <div className="px-6 py-4 bg-[#8a1ccf]">
          <h2 className="text-2xl font-semibold text-white">Report Details</h2>
        </div>
        {/* Content */}
        <div className="px-6 py-8 space-y-6 text-black">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              ['Student Name', report.studentName],
              ['Student Mobile', report.studentPhone],
              ['WhatsApp Number', report.whatsappNumber],
              ['Email', report.studentEmail],
              ['Grade', report.grade],
              ['Course Purchased', report.course],
              ['Status', report.status],
              ['Consultant Name', employeeName],
              ['Consultant ID', companyId],
              ['Purchased Date', report.createdAt
                      ? report.createdAt.toDate().toLocaleDateString()
                      : '—']
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-sm text-gray-600">{label}</p>
                <p className="mt-1 font-medium text-gray-900">{value || '—'}</p>
              </div>
            ))}
          </div>
          {/* Back Button */}
          <div className="mt-8 text-center">
            <button
              onClick={() => navigate(backTo)}
              className="px-6 py-2 bg-[#8a1ccf] text-white rounded-lg shadow hover:brightness-110 transition"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
