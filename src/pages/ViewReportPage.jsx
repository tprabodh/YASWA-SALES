// src/pages/ViewReportPage.jsx
import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useParams, useNavigate } from 'react-router-dom';
import '../styles.css'; // Ensure this import is present

export default function ViewReportPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);

  useEffect(() => {
    if (!id) return;
    getDoc(doc(db, 'reports', id)).then(snap => {
      if (snap.exists()) {
        setReport(snap.data());
      } else {
        alert('Report not found');
        navigate('/reports');
      }
    });
  }, [id, navigate]);

  if (!report) return <div className="loading">Loading…</div>;

  return (
    <div className="report-container">
      <h2 className="report-title">Report Details</h2>
      <div className="report-details">
        <p><strong>Student Name:</strong> {report.studentName}</p>
        <p><strong>Phone:</strong> {report.studentPhone}</p>
        <p><strong>Email:</strong> {report.studentEmail}</p>
        <p><strong>Grade:</strong> {report.grade}</p>
        <p><strong>Course:</strong> {report.course}</p>
        <p><strong>Price:</strong> {report.price}</p>
        <p><strong>Transaction ID:</strong> {report.transactionId}</p>
        <p><strong>Status:</strong> {report.status}</p>
      </div>
      <button onClick={() => navigate('/reports')} className="back-button">
        Back
      </button>
    </div>
  );
}
