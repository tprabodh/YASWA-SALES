// src/pages/AssignManagersPage.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  arrayUnion,
  arrayRemove,
  query,
  where
} from 'firebase/firestore';
import { db } from '../firebase';

export default function AssignManagersPage() {
  const { teleId } = useParams();       // telecaller’s user ID
  const navigate   = useNavigate();

  const [tele, setTele]       = useState(null);
  const [managers, setManagers] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading]   = useState(true);

  // 1️⃣ Load telecaller profile + existing managing list
  useEffect(() => {
    (async () => {
      const teleRef = doc(db, 'users', teleId);
      const teleSnap = await getDoc(teleRef);
      if (!teleSnap.exists()) {
        alert('Telecaller not found');
        return navigate(-1);
      }
      const data = teleSnap.data();
      setTele({ id: teleId, ...data });
      setSelected(new Set(data.managing || []));
      // 2️⃣ Load all managers
      const mgrSnap = await getDocs(
        query(collection(db, 'users'), where('role', '==', 'manager'))
      );
      setManagers(
        mgrSnap.docs.map(d => ({
          id: d.id,
          name: d.data().name,
          companyId: d.data().companyId
        }))
      );
      setLoading(false);
    })();
  }, [teleId, navigate]);

  const toggle = companyId => {
    setSelected(s => {
      const next = new Set(s);
      next.has(companyId) ? next.delete(companyId) : next.add(companyId);
      return next;
    });
  };

  const handleSave = async () => {
    const teleRef = doc(db, 'users', teleId);
    // Overwrite the entire managing array:
    await updateDoc(teleRef, { managing: Array.from(selected) });
    alert('Managers updated');
    navigate(-1);
  };

  if (loading) {
    return <p className="p-6">Loading…</p>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 text-indigo-600 hover:underline"
      >
        &larr; Back
      </button>

      <h2 className="text-2xl font-bold mb-4">
        Assign Managers to {tele.name}
      </h2>

      <div className="bg-white p-4 rounded shadow">
        {managers.map(m => (
          <label
            key={m.companyId}
            className="flex items-center space-x-2 mb-2"
          >
            <input
              type="checkbox"
              checked={selected.has(m.companyId)}
              onChange={() => toggle(m.companyId)}
              className="form-checkbox"
            />
            <span>
              {m.name} ({m.companyId})
            </span>
          </label>
        ))}
        {managers.length === 0 && (
          <p className="text-gray-500">No managers found.</p>
        )}
      </div>

      <button
        onClick={handleSave}
        className="mt-6 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
      >
        Save
      </button>
    </div>
  );
}
