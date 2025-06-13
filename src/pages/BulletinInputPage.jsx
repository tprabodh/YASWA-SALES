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
  { label: 'Education Counseller',     value: 'employee' },
    { label: 'Sales Associate',        value: 'associate' },
  { label: 'Business Development Counseller',  value: 'businessDevelopmentCounseller' },
  { label: 'Team Lead',                value: 'manager' },
  { label: 'Telecaller/Sales manager',             value: 'telecaller' },
  { label: 'Senior Manager',          value: 'businessHead' },
  { label: 'Sales Head',      value: 'salesHead' },
  { label: 'Admin',                  value: 'admin' },
  // …etc, add any other custom roles you use…
];

export default function BulletinInputPage() {
  const { profile, loading } = useUserProfile();

  // form state
  const [contentType, setContentType] = useState('text');
  const [textContent, setTextContent] = useState('');
  const [linkContent, setLinkContent] = useState('');
  const [photoFile, setPhotoFile]     = useState(null);
  const [docFile, setDocFile]         = useState(null);
  const [uploading, setUploading]     = useState(false);

  const [selectedRoles, setSelectedRoles] = useState([]);
  const [errorMsg, setErrorMsg]           = useState('');
  const [successMsg, setSuccessMsg]       = useState('');

  // only admin can access
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
    setDocFile(null);
    setSelectedRoles([]);
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handlePhotoChange = e => {
    setPhotoFile(e.target.files[0] || null);
  };
  const handleDocChange = e => {
    setDocFile(e.target.files[0] || null);
  };

  const handlePublish = async e => {
    e.preventDefault();
    setErrorMsg(''); setSuccessMsg('');

    if (!selectedRoles.length) {
      setErrorMsg('Please select at least one role.');
      return;
    }

    let finalContent = '';
    let finalType    = contentType;

    if (contentType === 'text') {
      if (!textContent.trim()) {
        setErrorMsg('Please enter some text.');
        return;
      }
      finalContent = textContent.trim();

    } else if (contentType === 'link') {
      if (!linkContent.trim()) {
        setErrorMsg('Please enter a valid URL.');
        return;
      }
      finalContent = linkContent.trim();

    } else if (contentType === 'photo') {
      if (!photoFile) {
        setErrorMsg('Please select a photo.');
        return;
      }
      setUploading(true);
      try {
        const filename = `bulletin_photo_${Date.now()}_${photoFile.name}`;
        const refStorage = storageRef(storage, `bulletin_photos/${filename}`);
        await uploadBytes(refStorage, photoFile);
        finalContent = await getDownloadURL(refStorage);
      } catch (err) {
        console.error(err);
        setErrorMsg('Photo upload failed.');
        setUploading(false);
        return;
      }
      setUploading(false);

    } else if (contentType === 'document') {
      if (!docFile) {
        setErrorMsg('Please select a document file.');
        return;
      }
      setUploading(true);
      try {
        const filename = `bulletin_doc_${Date.now()}_${docFile.name}`;
        const refStorage = storageRef(storage, `bulletin_documents/${filename}`);
        await uploadBytes(refStorage, docFile);
        finalContent = await getDownloadURL(refStorage);
      } catch (err) {
        console.error(err);
        setErrorMsg('Document upload failed.');
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    try {
      await addDoc(collection(db, 'bulletins'), {
        contentType: finalType,
        content:     finalContent,
        roles:       selectedRoles,
        createdAt:   serverTimestamp()
      });
      setSuccessMsg('Bulletin published successfully.');
      resetForm();
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to publish bulletin.');
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto bg-white rounded shadow">
      <h2 className="text-2xl font-bold mb-4">Publish New Bulletin</h2>

      {errorMsg && <div className="mb-4 text-red-700 bg-red-100 px-3 py-2 rounded">{errorMsg}</div>}
      {successMsg && <div className="mb-4 text-green-700 bg-green-100 px-3 py-2 rounded">{successMsg}</div>}

      <form onSubmit={handlePublish} className="space-y-6">
        {/* Content Type */}
        <div>
          <label className="block text-sm font-medium">Content Type</label>
          <select
            value={contentType}
            onChange={e => { setContentType(e.target.value); setErrorMsg(''); }}
            className="mt-1 w-full border-gray-300 rounded-md shadow-sm"
          >
            <option value="text">Text</option>
            <option value="link">Link (URL)</option>
            <option value="photo">Photo</option>
            <option value="document">Document (.doc/.docx)</option>
          </select>
        </div>

        {/* Text */}
        {contentType === 'text' && (
          <div>
            <label className="block text-sm font-medium">Text</label>
            <textarea
              rows={4}
              value={textContent}
              onChange={e => setTextContent(e.target.value)}
              className="mt-1 w-full border-gray-300 rounded-md shadow-sm p-2"
            />
          </div>
        )}

        {/* Link */}
        {contentType === 'link' && (
          <div>
            <label className="block text-sm font-medium">URL</label>
            <input
              type="url"
              value={linkContent}
              onChange={e => setLinkContent(e.target.value)}
              placeholder="https://example.com"
              className="mt-1 w-full border-gray-300 rounded-md shadow-sm px-3 py-2"
            />
          </div>
        )}

        {/* Photo */}
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
                className="mt-2 max-h-48 border rounded"
              />
            )}
          </div>
        )}

        {/* Document */}
        {contentType === 'document' && (
          <div>
            <label className="block text-sm font-medium">Upload Document</label>
            <input
              type="file"
              accept=".doc,.docx"
              onChange={handleDocChange}
              className="mt-1 block w-full"
            />
            {docFile && (
              <p className="mt-2 text-sm text-gray-700">{docFile.name}</p>
            )}
          </div>
        )}

        {/* Roles */}
        <div>
          <label className="block text-sm font-medium">Visible To</label>
          <div className="mt-1 p-2 border-gray-300 rounded-md shadow-sm grid grid-cols-2 gap-2">
            {ALL_ROLES.map(r => (
              <label key={r.value} className="inline-flex items-center space-x-2">
                <input
                  type="checkbox"
                  value={r.value}
                  checked={selectedRoles.includes(r.value)}
                  onChange={() => {
                    setSelectedRoles(prev =>
                      prev.includes(r.value)
                        ? prev.filter(x => x !== r.value)
                        : [...prev, r.value]
                    );
                  }}
                  className="form-checkbox h-4 w-4 text-indigo-600"
                />
                <span>{r.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Publish */}
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
