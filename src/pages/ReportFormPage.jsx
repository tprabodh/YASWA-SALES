// src/pages/ReportFormPage.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../firebase';
import {
  collection,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import useAuth from '../hooks/UseAuth';
import { useForm } from 'react-hook-form';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function ReportFormPage() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [loadingSubmit, setLoadingSubmit] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      saleDate: 'today'
    }
  });

  // load existing when editing
  useEffect(() => {
    if (!isEditing || loading || !user) return;
    (async () => {
      const snap = await getDoc(doc(db, 'reports', id));
      if (snap.exists()) {
        const data = snap.data();
        setValue('studentName', data.studentName);
        setValue('studentPhone', data.studentPhone);
        setValue('studentEmail', data.studentEmail);
        setValue('grade', data.grade);
        setValue('course', data.course);
        setValue('whatsappNumber', data.whatsappNumber);
        // if you stored saleDate as a string, set it here
        // otherwise leave default
      }
    })();
  }, [id, isEditing, loading, user, setValue]);

  const onSubmit = async (formData) => {
    if (loading || !user) {
      toast.error('Please log in first.');
      return;
    }
    setLoadingSubmit(true);

    try {
      // determine createdAt from saleDate
      const now = new Date();
      let saleDate = new Date();
      if (formData.saleDate === 'yesterday') {
        saleDate.setDate(now.getDate() - 1);
      }
      // set to midnight for consistency
      saleDate.setHours(0,0,0,0);
      const createdAtTs = isEditing
        ? undefined
        : Timestamp.fromDate(saleDate);

      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);
      if (!userDocSnap.exists()) throw new Error('User profile not found');
      const userData = userDocSnap.data();

      const payload = {
        studentName: formData.studentName,
        studentPhone: formData.studentPhone,
        studentEmail: formData.studentEmail,
        whatsappNumber: formData.whatsappNumber,
        grade: formData.grade,
        course: formData.course,
        userId: user.uid,
        managerId: userData.supervisorId || null,
        companyId: userData.companyId,
        status: 'pending',
        updatedAt: serverTimestamp(),
        ...(isEditing
          ? {}
          : { createdAt: createdAtTs })
      };

      if (isEditing) {
        await updateDoc(doc(db, 'reports', id), payload);
        toast.success('Report updated successfully');
      } else {
        await addDoc(collection(db, 'reports'), payload);
        toast.success('Report submitted successfully');
      }
      navigate('/reports');
    } catch (err) {
      console.error(err);
      toast.error(`Error: ${err.message}`);
    } finally {
      setLoadingSubmit(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><p>Loading…</p></div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-6 sm:p-8">
        
        <h1 className="text-xl sm:text-2xl font-semibold text-center text-[#8a1ccf] mb-6">
          {isEditing ? 'Edit Sales Report' : 'New Sales Report'}
        </h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Sale Date Selector */}
          <div>
            <p className="block text-sm font-medium mb-1">The Date Sale is Made On</p>
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

          {/* Student Name */}
          <div>
            <label className="block text-sm font-medium mb-1">Student Name</label>
            <input
              type="text"
              {...register('studentName', { required: 'Student name is required' })}
              className="w-full px-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#8a1ccf]"
            />
            {errors.studentName && (
              <p className="text-red-500 text-xs mt-1">{errors.studentName.message}</p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium mb-1">Student Mobile Number</label>
            <input
              type="tel"
              {...register('studentPhone', {
                required: 'Mobile number is required',
                pattern: {
                  value: /^[0-9]{10}$/,
                  message: 'Enter a valid 10-digit mobile number',
                },
              })}
              className="w-full px-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#8a1ccf]"
            />
            {errors.studentPhone && (
              <p className="text-red-500 text-xs mt-1">{errors.studentPhone.message}</p>
            )}
          </div>

          {/* WhatsApp */}
          <div>
            <label className="block text-sm font-medium mb-1">Student Whatsapp Number</label>
            <input
              type="tel"
              {...register('whatsappNumber', {
                required: 'Whatsapp number is required',
                pattern: {
                  value: /^[0-9]{10}$/,
                  message: 'Enter a valid 10-digit Whatsapp number',
                },
              })}
              className="w-full px-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#8a1ccf]"
            />
            {errors.whatsappNumber && (
              <p className="text-red-500 text-xs mt-1">{errors.whatsappNumber.message}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-1">Student Email ID</label>
            <input
              type="email"
              {...register('studentEmail', {
                required: 'Email is required',
                pattern: {
                  value: /^\S+@\S+$/i,
                  message: 'Enter a valid email address',
                },
              })}
              className="w-full px-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#8a1ccf]"
            />
            {errors.studentEmail && (
              <p className="text-red-500 text-xs mt-1">{errors.studentEmail.message}</p>
            )}
          </div>

          {/* Grade */}
          <div>
            <label className="block text-sm font-medium mb-1">Student Grade</label>
            <select
              {...register('grade', { required: 'Grade selection is required' })}
              className="w-full px-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#8a1ccf]"
            >
              <option value="">Select</option>
              <option value="PU1">11th/PU1/Intermediate 1st year</option>
              <option value="PU2">12th/PU2/Intermediate 2nd year</option>
            </select>
            {errors.grade && (
              <p className="text-red-500 text-xs mt-1">{errors.grade.message}</p>
            )}
          </div>

          {/* Course */}
          <div>
            <label className="block text-sm font-medium mb-1">Course Purchased</label>
            <select
              {...register('course', { required: 'Course selection is required' })}
              className="w-full px-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#8a1ccf]"
            >
              <option value="">Select</option>
              <option value="JEE MAINS">JEE MAINS</option>
              <option value="NEET UG">NEET UG</option>
            </select>
            {errors.course && (
              <p className="text-red-500 text-xs mt-1">{errors.course.message}</p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loadingSubmit}
            className="w-full py-2 bg-[#8a1ccf] text-white rounded-md font-semibold hover:brightness-110 transition disabled:opacity-60"
          >
            {loadingSubmit
              ? isEditing
                ? 'Updating…'
                : 'Submitting…'
              : isEditing
              ? 'Update Report'
              : 'Submit Report'}
          </button>
        </form>
      </div>
      <ToastContainer position="top-center" autoClose={3000} />
    </div>
  );
}
