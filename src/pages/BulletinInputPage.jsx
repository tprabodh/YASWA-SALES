// src/pages/BulletinInputPage.jsx
import React, { useState, useEffect } from 'react';
import { Navigate }             from 'react-router-dom';
import { useUserProfile }       from '../hooks/useUserProfile';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { storage, db }          from '../firebase';
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL
} from 'firebase/storage';

const ALL_ROLES = [
  { label: 'Admissions Officer',     value: 'employee' },
  { label: 'Telecaller',              value: 'telecaller' },
  { label: 'Manager',                 value: 'manager' },
  { label: 'Sales Associate',         value: 'associate' },
  { label: 'Business Head',           value: 'businessHead' },
  { label: 'Associate Manager',       value: 'associateManager' },
  { label: 'Admin',                   value: 'admin' },
  // …etc, add any other custom roles you use…
];

export default function BulletinInputPage() {
  const { profile, loading } = useUserProfile();
  const [contentType, setContentType] = useState('text');
  const [textContent, setTextContent] = useState('');
  const [linkContent, setLinkContent] = useState('');
  const [photoFile, setPhotoFile]     = useState(null);
  const [uploading, setUploading]     = useState(false);

  const [selectedRoles, setSelectedRoles] = useState([]);
  const [errorMsg, setErrorMsg]     = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 1) Guard: only “admin” can publish
  if (!loading && profile?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  if (loading) {
    return <p className="p-6">Loading…</p>;
  }

  const resetForm = () => {
    setTextContent('');
    setLinkContent('');
    setPhotoFile(null);
    setSelectedRoles([]);
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handlePhotoChange = (e) => {
    const chosen = e.target.files[0] || null;
    setPhotoFile(chosen);
  };

  const handlePublish = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (selectedRoles.length === 0) {
      setErrorMsg('Please select at least one role.');
      return;
    }

    let finalContentURL = '';
    if (contentType === 'text') {
      if (!textContent.trim()) {
        setErrorMsg('Please enter some text to publish.');
        return;
      }
      finalContentURL = textContent.trim();
    } else if (contentType === 'link') {
      if (!linkContent.trim()) {
        setErrorMsg('Please enter a valid URL.');
        return;
      }
      finalContentURL = linkContent.trim();
    } else if (contentType === 'photo') {
      if (!photoFile) {
        setErrorMsg('Please select a photo file to upload.');
        return;
      }
      setUploading(true);
      try {
        // upload to Storage under “bulletin_photos/…”
        const filename = `bulletin_${Date.now()}_${photoFile.name}`;
        const storageReference = storageRef(storage, `bulletin_photos/${filename}`);
        await uploadBytes(storageReference, photoFile);
        finalContentURL = await getDownloadURL(storageReference);
      } catch (err) {
        console.error('Photo upload failed:', err);
        setErrorMsg('Failed to upload photo.');
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    try {
      await addDoc(collection(db, 'bulletins'), {
        contentType,
        content: finalContentURL,
        roles: selectedRoles,
        createdAt: serverTimestamp()
      });
      setSuccessMsg('Bulletin published successfully.');
      resetForm();
    } catch (err) {
      console.error('Firestore write failed:', err);
      setErrorMsg('Failed to publish bulletin.');
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto bg-white rounded shadow">
      <br /><br />
      <h2 className="text-2xl font-bold mb-4">Publish New Bulletin</h2>

      {errorMsg && (
        <div className="mb-4 text-red-700 bg-red-100 px-3 py-2 rounded">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="mb-4 text-green-700 bg-green-100 px-3 py-2 rounded">
          {successMsg}
        </div>
      )}

      <form onSubmit={handlePublish} className="space-y-6">
        {/* 1) Content Type Selector */}
        <div>
          <label className="block text-sm font-medium">Content Type</label>
          <select
            value={contentType}
            onChange={e => setContentType(e.target.value)}
            className="mt-1 w-full border-gray-300 rounded-md shadow-sm"
          >
            <option value="text">Text</option>
            <option value="link">Link (URL)</option>
            <option value="photo">Photo Upload</option>
          </select>
        </div>

        {/* 2a) If “text” → show textarea */}
        {contentType === 'text' && (
          <div>
            <label className="block text-sm font-medium">Bulletin Text</label>
            <textarea
              rows={4}
              value={textContent}
              onChange={e => setTextContent(e.target.value)}
              className="mt-1 w-full border-gray-300 rounded-md shadow-sm p-2"
            />
          </div>
        )}

        {/* 2b) If “link” → show URL field */}
        {contentType === 'link' && (
          <div>
            <label className="block text-sm font-medium">Bulletin Link (URL)</label>
            <input
              type="url"
              value={linkContent}
              onChange={e => setLinkContent(e.target.value)}
              placeholder="https://example.com/..."
              className="mt-1 w-full border-gray-300 rounded-md shadow-sm px-3 py-2"
            />
          </div>
        )}

        {/* 2c) If “photo” → show file input + preview */}
        {contentType === 'photo' && (
          <div>
            <label className="block text-sm font-medium">Upload Photo</label>
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="mt-1 block w-full"
            />
            {photoFile && (
              <img
                src={URL.createObjectURL(photoFile)}
                alt="Preview"
                className="mt-2 max-h-48 border"
              />
            )}
          </div>
        )}

        {/* 3) Select which roles can see this bulletin */}
        <div>
          <label className="block text-sm font-medium">Visible To (Select one or more)</label>
          <div className="mt-1 border-gray-300 rounded-md shadow-sm p-2">
            {ALL_ROLES.map(r => (
              <label key={r.value} className="inline-flex items-center mr-4 mb-2">
                <input
                  type="checkbox"
                  value={r.value}
                  checked={selectedRoles.includes(r.value)}
                  onChange={e => {
                    const val = e.target.value;
                    setSelectedRoles(prev =>
                      prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]
                    );
                  }}
                  className="form-checkbox h-4 w-4 text-indigo-600"
                />
                <span className="ml-2 text-gray-700">{r.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 4) Publish Button */}
        <button
          type="submit"
          disabled={uploading}
          className={`px-4 py-2 rounded text-white ${
            uploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
          }`}
        >
          {uploading ? 'Publishing…' : 'Publish Bulletin'}
        </button>
      </form>
    </div>
  );
}
