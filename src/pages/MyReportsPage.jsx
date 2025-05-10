// src/pages/MyReportsPage.jsx
import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { useAuth } from '../hooks/UseAuth';
import { useNavigate } from 'react-router-dom';

export default function MyReportsPage() {
  const user = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'reports'),
      where('userId', '==', user.uid)
    );
    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setReports(data);
    });
    return () => unsub();
  }, [user]);

  const handleDelete = async id => {
    if (!window.confirm('Delete this report?')) return;
    await deleteDoc(doc(db, 'reports', id));
  };

  return (
    <div className="page-container">
      <h2>My Reports</h2>
      <table>
        <thead>
          <tr>
            <th>Student</th>
            <th>Course</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {reports.map(r => (
            <tr key={r.id}>
              <td>{r.studentName}</td>
              <td>{r.course}</td>
              <td>{r.status}</td>
              <td>
                <button className="text-brand hover:underline" onClick={() => navigate(`/view/${r.id}`)}>
                  View
                </button>
                <button onClick={() => navigate(`/submit/${r.id}`)}>
                  Edit
                </button>
                <button onClick={() => handleDelete(r.id)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
