// src/pages/ManagerViewPage.jsx
import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useUserProfile } from '../hooks/useUserProfile';
import { useNavigate } from 'react-router-dom';

export default function ManagerViewPage() {
  const { profile, loading } = useUserProfile();
  const [reports, setReports] = useState([]);
  const navigate = useNavigate();


  useEffect(() => {
    if (loading || !profile) return;
    console.log('Manager companyId:', profile.companyId);

  
    const fetchReports = async () => {
      try {
        const reportsRef = collection(db, 'reports');
        const q = query(reportsRef, where('managerId', '==', profile.companyId));
        const querySnapshot = await getDocs(q);
        const reportsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setReports(reportsData);
      } catch (error) {
        console.error('Error fetching reports:', error);
      }
    };
  
    fetchReports();
  }, [loading, profile]);
  

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2>Reports Managed by You</h2>
      {reports.length === 0 ? (
        <p>No reports found.</p>
      ) : (
        <table className="reports-table">
          <thead>
            <tr>
              <th>Student Name</th>
              <th>Course</th>
              <th>Status</th>
              <th>View</th>
            </tr>
          </thead>
          <tbody>
            {reports.map(report => (
              <tr key={report.id}>
                <td>{report.studentName}</td>
                <td>{report.course}</td>
                <td>{report.status}</td>
                <td>
                  <button onClick={() => navigate(`/view/${report.id}`)}>
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
