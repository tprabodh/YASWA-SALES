import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../firebase';
import {
  collection,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { useAuth } from '../hooks/UseAuth';

export default function ReportFormPage() {
  const { id } = useParams(); // for edit mode
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const user = useAuth();

  // form fields
  const [studentName, setStudentName] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [grade, setGrade] = useState('');
  const [course, setCourse] = useState('');
  const [price, setPrice] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [loading, setLoading] = useState(false);
  


  // if editing, load existing data
  useEffect(() => {
    if (!isEditing) return;
    const docRef = doc(db, 'reports', id);
    getDoc(docRef).then(docSnap => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setStudentName(data.studentName);
        setStudentPhone(data.studentPhone);
        setStudentEmail(data.studentEmail);
        setGrade(data.grade);
        setCourse(data.course);
        setPrice(data.price);
        setTransactionId(data.transactionId);
      }
    });
  }, [id, isEditing]);

  const handleSubmit = async e => {
    e.preventDefault();
    if (!user) return alert('Log in first');
    setLoading(true);
  
    try {
      // Fetch the current user's document
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);
  
      if (!userDocSnap.exists()) {
        throw new Error('User profile not found');
      }
  
      const userData = userDocSnap.data();
      const managerId = userData.supervisorId;
  
      const payload = {
        studentName,
        studentPhone,
        studentEmail,
        grade,
        course,
        price,
        transactionId,
        userId: user.uid,
        managerId,
        status: 'pending',
        updatedAt: serverTimestamp(),
        ...(isEditing ? {} : { createdAt: serverTimestamp() }),
      };
  
      if (isEditing) {
        const docRef = doc(db, 'reports', id);
        await updateDoc(docRef, payload);
        alert('Report updated');
      } else {
        await addDoc(collection(db, 'reports'), payload);
        alert('Report submitted');
      }
      navigate('/reports');
    } catch (err) {
      console.error(err);
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };
  
  

  return (
    <div className="form-container">
      <h2 className="form-title">
        {isEditing ? 'Edit Report' : 'New Report'}
      </h2>
      <form onSubmit={handleSubmit} className="form">
        <label className="form-group">
          <span className="form-label">Student Name</span>
          <input
            type="text"
            value={studentName}
            onChange={e => setStudentName(e.target.value)}
            required
            className="form-input"
          />
        </label>

        <label className="form-group">
          <span className="form-label">Phone Number</span>
          <input
            type="tel"
            value={studentPhone}
            onChange={e => setStudentPhone(e.target.value)}
            required
            className="form-input"
          />
        </label>

        <label className="form-group">
          <span className="form-label">Email ID</span>
          <input
            type="email"
            value={studentEmail}
            onChange={e => setStudentEmail(e.target.value)}
            required
            className="form-input"
          />
        </label>

        <label className="form-group">
          <span className="form-label">Grade</span>
          <input
            type="text"
            value={grade}
            onChange={e => setGrade(e.target.value)}
            required
            className="form-input"
          />
        </label>

        <label className="form-group">
          <span className="form-label">Course</span>
          <input
            type="text"
            value={course}
            onChange={e => setCourse(e.target.value)}
            required
            className="form-input"
          />
        </label>

        <label className="form-group">
          <span className="form-label">Price</span>
          <input
            type="number"
            value={price}
            onChange={e => setPrice(e.target.value)}
            required
            className="form-input"
          />
        </label>

        <label className="form-group">
          <span className="form-label">Reference / Transaction ID</span>
          <input
            type="text"
            value={transactionId}
            onChange={e => setTransactionId(e.target.value)}
            required
            className="form-input"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="form-button"
        >
          {loading ? 'Saving…' : isEditing ? 'Update Report' : 'Submit Report'}
        </button>
      </form>
    </div>
  );
}
