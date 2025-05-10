// src/pages/AdminDashboardPage.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboardPage() {
  const [reports, setReports] = useState([]);
  const navigate = useNavigate();

  // fetch reports
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'reports'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setReports(data);
    });
    return () => unsub();
  }, []);

  const updateStatus = async (id, status) => {
    const ref = doc(db, 'reports', id);
    await updateDoc(ref, { status });
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Admin Dashboard</h2>
      <button onClick={() => navigate('/employee-management')}>
        Go to Employee Management
      </button>
      <br /><br />
      <table border="1" cellPadding="8" cellSpacing="0">
        <thead>
          <tr>
            <th>Student Name</th>
            <th>Phone</th>
            <th>Email</th>
            <th>Grade</th>
            <th>Course</th>
            <th>Price</th>
            <th>Transaction ID</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {reports.map(r => (
            <tr key={r.id}>
              <td>{r.studentName}</td>
              <td>{r.studentPhone}</td>
              <td>{r.studentEmail}</td>
              <td>{r.grade}</td>
              <td>{r.course}</td>
              <td>{r.price}</td>
              <td>{r.transactionId}</td>
              <td>{r.status}</td>
              <td>
                <button onClick={() => updateStatus(r.id, 'approved')}>Approve</button>
                <button onClick={() => updateStatus(r.id, 'rejected')}>Reject</button>
                <button onClick={() => navigate(`/view/${r.id}`)}>View</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
