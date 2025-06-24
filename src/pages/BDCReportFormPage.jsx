// src/pages/BDCReportFormPage.jsx

import React, { useEffect, useState } from 'react';
import { useNavigate }              from 'react-router-dom';
import { db }                       from '../firebase';
import {
  collection,
  addDoc,
  doc,
  getDoc,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import useAuth                      from '../hooks/UseAuth';
import { useForm }                  from 'react-hook-form';
import { ToastContainer, toast }    from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function BDCReportFormPage() {
  const navigate       = useNavigate();
  const { user, loading } = useAuth();
  const [loadingSubmit, setLoadingSubmit] = useState(false);

  // react-hook-form setup
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      saleDate: 'today',
      collegeName: '',
      areaName: '',
      jeePackages: 0,
      neetPackages: 0,
    }
  });

  // Helper: convert “today” / “yesterday” into a Firestore Timestamp at midnight
  function computeTimestamp(saleDateValue) {
    const now = new Date();
    let d = new Date();
    if (saleDateValue === 'yesterday') {
      d.setDate(now.getDate() - 1);
    }
    // set to midnight
    d.setHours(0, 0, 0, 0);
    return Timestamp.fromDate(d);
  }

  // Handle actual form‐submit
  const onSubmit = async (data) => {
    if (loading || !user) {
      toast.error('Please log in first.');
      return;
    }
    setLoadingSubmit(true);

    try {
      // 1) Build “createdAtTs” from saleDate
      const createdAtTs = computeTimestamp(data.saleDate);

      // 2) Lookup this user’s document to grab supervisorId & companyId
      const userDocRef  = doc(db, 'users', user.uid);
      const userSnap    = await getDoc(userDocRef);
      if (!userSnap.exists()) throw new Error('User profile not found');
      const userData    = userSnap.data();

      // 3) Build “studentName” as "<collegeName>-<jeePackages>-<neetPackages>"
      const studentName = `${data.collegeName.trim()}-${data.jeePackages}-${data.neetPackages}`;

      // 4) Prepare payload
      const payload = {
        // the concatenated field:
        studentName,
        // store raw collegeName & areaName & counts as separate fields too:
        collegeName:         data.collegeName.trim(),
        areaName:            data.areaName.trim(),
        jeePackages:         Number(data.jeePackages),
        neetPackages:        Number(data.neetPackages),

        // standard report fields:
        userId:              user.uid,
        managerId:           userData.supervisorId || null,
        companyId:           userData.companyId,
        status:              'pending',
        createdAt:           createdAtTs,
        updatedAt:           serverTimestamp(),
      };

      // 5) Add to Firestore “reports” collection
      await addDoc(collection(db, 'reports'), payload);
      toast.success('BDC report submitted successfully');
      navigate('/reports'); // or wherever you want to redirect
    } catch (err) {
      console.error(err);
      toast.error(`Error: ${err.message}`);
    } finally {
      setLoadingSubmit(false);
    }
  };

  // If the auth hook is still loading, show a spinner
   if ( loading) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
        <svg
          className="w-16 h-16 text-[#8a1ccf] animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none" viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12" cy="12" r="10"
            stroke="currentColor" strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8z"
          />
        </svg>
      </div>
    );
  }

  // Main render
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-6 sm:p-8">
        <h1 className="text-2xl sm:text-2xl font-extrabold text-center text-[#8a1ccf] mb-6">
          {`New BDC Sales Report`}
        </h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

          {/* ─── Date of Sale ────────────────────────────────────────────────────────── */}
          <div>
            <p className="block text-sm font-medium mb-1">The Date Sale Is Made On</p>
            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="today"
                  {...register('saleDate')}
                  className="form-radio"
                />
                <span className="ml-2">Today</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="yesterday"
                  {...register('saleDate')}
                  className="form-radio"
                />
                <span className="ml-2">Yesterday</span>
              </label>
            </div>
          </div>

          {/* ─── College Name ───────────────────────────────────────────────────────── */}
          <div>
            <label className="block text-sm font-medium mb-1">College Name</label>
            <input
              type="text"
              {...register('collegeName', {
                required: 'College name is required'
              })}
              className="w-full px-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#8a1ccf]"
            />
            {errors.collegeName && (
              <p className="text-red-500 text-xs mt-1">{errors.collegeName.message}</p>
            )}
          </div>

          {/* ─── Area Name ─────────────────────────────────────────────────────────── */}
          <div>
            <label className="block text-sm font-medium mb-1">College Area Name</label>
            <input
              type="text"
              {...register('areaName', {
                required: 'Area name is required'
              })}
              className="w-full px-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#8a1ccf]"
            />
            {errors.areaName && (
              <p className="text-red-500 text-xs mt-1">{errors.areaName.message}</p>
            )}
          </div>

          {/* ─── No. of JEE MAINS Packages ───────────────────────────────────────────── */}
          <div>
            <label className="block text-sm font-medium mb-1">No. of JEE MAINS Packages</label>
            <input
              type="number"
              min="0"
              {...register('jeePackages', {
                required: 'Enter JEE package count',
                valueAsNumber: true,
                min: {
                  value: 0,
                  message: 'Cannot be negative'
                }
              })}
              className="w-full px-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#8a1ccf]"
            />
            {errors.jeePackages && (
              <p className="text-red-500 text-xs mt-1">{errors.jeePackages.message}</p>
            )}
          </div>

          {/* ─── No. of NEET UG Packages ────────────────────────────────────────────── */}
          <div>
            <label className="block text-sm font-medium mb-1">No. of NEET UG Packages</label>
            <input
              type="number"
              min="0"
              {...register('neetPackages', {
                required: 'Enter NEET package count',
                valueAsNumber: true,
                min: {
                  value: 0,
                  message: 'Cannot be negative'
                }
              })}
              className="w-full px-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#8a1ccf]"
            />
            {errors.neetPackages && (
              <p className="text-red-500 text-xs mt-1">{errors.neetPackages.message}</p>
            )}
          </div>

          {/* ─── Submit Button ──────────────────────────────────────────────────────── */}
          <button
            type="submit"
            disabled={loadingSubmit}
            className="w-full py-2 bg-[#8a1ccf] text-white rounded-md font-semibold hover:brightness-110 transition disabled:opacity-60"
          >
            {loadingSubmit ? 'Submitting…' : 'Submit Report'}
          </button>
        </form>
      </div>

      {/* ToastContainer (for any toast.success / toast.error calls) */}
      <ToastContainer position="top-center" autoClose={3000} />
    </div>
  );
}
