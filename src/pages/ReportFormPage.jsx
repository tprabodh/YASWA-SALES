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
  } = useForm();

  useEffect(() => {
    if (!isEditing || loading || !user) return;
    const fetchReport = async () => {
      try {
        const docRef = doc(db, 'reports', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setValue('studentName', data.studentName);
          setValue('studentPhone', data.studentPhone);
          setValue('studentEmail', data.studentEmail);
          setValue('grade', data.grade);
          setValue('course', data.course);
          setValue('whatsappNumber', data.whatsappNumber);
        }
      } catch (error) {
        toast.error('Failed to load report data.');
      }
    };
    fetchReport();
  }, [id, isEditing, setValue, loading, user]);

  const onSubmit = async (formData) => {
    if (loading || !user) {
      toast.error('Please log in first.');
      return;
    }
    setLoadingSubmit(true);

    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        throw new Error('User profile not found');
      }

      const userData = userDocSnap.data();
      const managerId = userData.supervisorId;
      const companyId = userData.companyId;

      const payload = {
        ...formData,
        userId: user.uid,
        managerId,
        companyId,
        status: 'pending',
        updatedAt: serverTimestamp(),
        ...(isEditing ? {} : { createdAt: serverTimestamp() }),
      };

      if (isEditing) {
        const docRef = doc(db, 'reports', id);
        await updateDoc(docRef, payload);
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
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-6 sm:p-8">
        <h1 className="text-xl sm:text-2xl font-semibold text-center text-[#8a1ccf] mb-6">
          {isEditing ? 'Edit Report' : 'New Report'}
        </h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

          <div>
            <label className="block text-sm font-medium mb-1">Student Grade</label>
            <select
              {...register('grade', { required: 'Grade selection is required' })}
              className="w-full px-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#8a1ccf]"
            >
              <option value="">Select</option>
              <option value="PU1">11th/PU1/Intermediate 1st year</option>
              <option value="PU2">12th/PU2/Intermediate 2nd year</option>
            </select>
            {errors.grade && (
              <p className="text-red-500 text-xs mt-1">{errors.grade.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Course Purchased</label>
            <select
              {...register('course', { required: 'Course selection is required' })}
              className="w-full px-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#8a1ccf]"
            >
              <option value="">Select</option>
              <option value="JEE MAINS">JEE MAINS</option>
              <option value="NEET UG">NEET UG</option>
            </select>
            {errors.course && (
              <p className="text-red-500 text-xs mt-1">{errors.course.message}</p>
            )}
          </div>
<br />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-purple-500 text-white rounded-md mb-6 rounded hover:bg-indigo-800"
            >
            {loading ? 'Saving…' : isEditing ? 'Update Report' : 'Submit Report'}
          </button>
        </form>
      </div>
      <ToastContainer position="top-center" autoClose={3000} />
    </div>
  );
}
