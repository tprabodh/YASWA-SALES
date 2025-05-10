// src/hooks/useUserProfile.js
import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

// ⚠️ Named export
export function useUserProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, user => {
      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }
      const profileRef = doc(db, 'users', user.uid);
      const unsubProfile = onSnapshot(profileRef, snap => {
        setProfile(snap.exists() ? snap.data() : null);
        setLoading(false);
      });
      return () => unsubProfile();
    });
    return () => unsubAuth();
  }, []);

  return { profile, loading };
}
