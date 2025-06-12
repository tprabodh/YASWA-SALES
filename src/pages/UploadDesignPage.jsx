// src/pages/UploadDesignPage.jsx

import React, { useState } from 'react';
import { Navigate }            from 'react-router-dom';
import { useUserProfile }      from '../hooks/useUserProfile';
import { storage, db }         from '../firebase';
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL
} from 'firebase/storage';
import {
  collection,
  addDoc,
  Timestamp
} from 'firebase/firestore';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function UploadDesignPage() {
  const { profile, loading } = useUserProfile();
  const [file, setFile]             = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [uploading, setUploading]   = useState(false);
  const [designType, setDesignType] = useState(''); // "pamphlet" or "visitingCard"

  // 1) Guard: only allow admin
  if (!loading && (!profile || profile.role !== 'admin')) {
    return <Navigate to="/YASWA-SALES/" replace />;
  }
  if (loading) {
    return <p className="p-6">Loading…</p>;
  }

  // 2) Handle file‐input change
  const handleFileChange = e => {
    const chosen = e.target.files[0];
    if (chosen) {
      setFile(chosen);
      const reader = new FileReader();
      reader.onload = () => setPreviewUrl(reader.result);
      reader.readAsDataURL(chosen);
    } else {
      setFile(null);
      setPreviewUrl('');
    }
  };

  // 3) Upload to Firebase Storage + Firestore
  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select an image first.');
      return;
    }
    if (!designType) {
      toast.error('Please choose a design type (Pamphlet or Visiting Card).');
      return;
    }

    // 4) Optionally, you could validate the image's natural dimensions here:
    //    e.g. create an <img> offscreen and check width/height match expected for pamphlet or visitingCard.
    //    For now we'll assume admin uploads the correct dimensions.

    setUploading(true);
    try {
      // a) Create a unique filename (e.g. timestamp + original name)
      const timestamp = Date.now();
      const fileExt   = file.name.split('.').pop();
      const filename  = `design_${designType}_${timestamp}.${fileExt}`;

      // b) Upload to Storage under /designs/{designType}/
      const storageReference = storageRef(storage, `designs/${designType}/${filename}`);
      await uploadBytes(storageReference, file);

      // c) Get the download URL
      const downloadURL = await getDownloadURL(storageReference);

      // d) Save a Firestore doc in “designs” collection
      await addDoc(collection(db, 'designs'), {
        url:        downloadURL,
        originalName: file.name,
        uploadedBy: profile.uid,
        uploadedAt: Timestamp.now(),
        type:       designType  // “pamphlet” or “visitingCard”
      });

      toast.success('Design uploaded successfully!');
      setFile(null);
      setPreviewUrl('');
      setDesignType('');
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Upload failed. Check console for details.');
    }
    setUploading(false);
  };

  return (
    <div className="p-6 max-w-xl mx-auto bg-white rounded shadow">
      <ToastContainer position="top-center" autoClose={3000} />
      <h2 className="text-2xl font-bold mb-4">Upload a New Design</h2>

      <div className="mb-4">
        <label className="block text-gray-700 mb-1">Design Type</label>
        <select
          value={designType}
          onChange={e => setDesignType(e.target.value)}
          className="mt-1 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8a1ccf]"
        >
          <option value="">Select type…</option>
          <option value="pamphlet">Pamphlet (1131×1600)</option>
          <option value="visitingCard">Visiting Card (1051×602)</option>
        </select>
      </div>

      <div className="mb-4">
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="block w-full"
        />
      </div>

      {previewUrl && (
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-1">Preview:</p>
          <img
            src={previewUrl}
            alt="Preview"
            className="max-h-48 w-auto border"
          />
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={uploading}
        className={`px-4 py-2 rounded text-white ${
          uploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {uploading ? 'Uploading…' : 'Upload Design'}
      </button>
    </div>
  );
}
