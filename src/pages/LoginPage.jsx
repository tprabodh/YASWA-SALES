import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';

function generateId(role) {
  const prefix = role === 'admin'
    ? 'ADM'
    : role === 'manager'
      ? 'MGR'
      : 'EMP';
  const suffix = Math.random().toString(36).substr(2, 6).toUpperCase();
  return `${prefix}-${suffix}`;
}

export default function LoginPage() {
  const [isNew, setIsNew] = useState(false);
  const [name, setName] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [supervisorId, setSupervisorId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const resetForm = () => {
    setName('');
    setCompanyId('');
    setSupervisorId('');
    setEmail('');
    setPassword('');
    setConfirm('');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isNew) {
      if (!name || !email || !password || password !== confirm) {
        setError('Please fill all fields correctly.');
        return;
      }
    }

    try {
      let userCred;

      if (isNew) {
        userCred = await createUserWithEmailAndPassword(auth, email, password);
        const newRole = 'employee';
        const newCompanyId = generateId(newRole);

        await setDoc(doc(db, 'users', userCred.user.uid), {
          name,
          email,
          role: newRole,
          companyId: newCompanyId,
          supervisorId: supervisorId || null,
          createdAt: serverTimestamp(),
        });

        alert(`Your employee code is: ${newCompanyId}`);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }

      resetForm();
      navigate('/reports');
    } catch (err) {
      console.error(err);
      setError(err.message);
    }
  };

  return (
    <div className="login-container">
      <h1>{isNew ? 'Sign Up' : 'Sign In'}</h1>

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit}>
        {isNew && (
          <>
            <label>Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <label>Company-Provided ID</label>
            <input
              type="text"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              required
            />

            <label>Supervisor ID (optional)</label>
            <input
              type="text"
              value={supervisorId}
              onChange={(e) => setSupervisorId(e.target.value)}
            />
          </>
        )}

        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {isNew && (
          <>
            <label>Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </>
        )}

        <button type="submit">
          {isNew ? 'Register' : 'Login'}
        </button>
      </form>

      <button
        className="toggle-button"
        onClick={() => {
          resetForm();
          setIsNew(!isNew);
        }}
      >
        {isNew
          ? 'Already have an account? Sign In'
          : 'New user? Create an account'}
      </button>
    </div>
  );
}
