// src/pages/BulletinInputPage.jsx
import React, { useState, useEffect } from 'react';
import { Navigate }                   from 'react-router-dom';
import { useUserProfile }             from '../hooks/useUserProfile';
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { storage, db }                from '../firebase';
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from 'firebase/storage';

const ALL_ROLES = [
  { label: 'Education Counseller',           value: 'employee' },
  { label: 'Sales Associate',                value: 'associate' },
  { label: 'Business Development Counseller',value: 'businessDevelopmentCounseller' },
  { label: 'Team Lead',                      value: 'manager' },
  { label: 'Telecaller/Sales Manager',       value: 'telecallerGroup' },
  { label: 'Senior Manager',                 value: 'businessHead' },
  { label: 'Sales Head',                     value: 'salesHead' },
  { label: 'Admin',                          value: 'admin' },
];

const TELE_SUBROLES = [
  { label: 'Telecaller',     value: 'telecaller'    },
  { label: 'Manager‑Sales',  value: 'managerSales'  },
];

export default function BulletinInputPage() {
  // ─── Hooks (always at the top!) ─────────────────────────────────────────
  const { profile, loading } = useUserProfile();

  // existing bulletins list for display/edit/delete
  const [bulletins, setBulletins] = useState([]);
  useEffect(() => {
    if (loading || !profile || profile.role !== 'admin') return;
    (async () => {
      const snap = await getDocs(
        collection(db, 'bulletins')
      );
      setBulletins(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    })();
  }, [loading, profile]);

  // form state
  const [title,         setTitle]         = useState('');
  const [contentType,   setContentType]   = useState('text');
  const [textContent,   setTextContent]   = useState('');
  const [linkContent,   setLinkContent]   = useState('');
  const [photoFile,     setPhotoFile]     = useState(null);
  const [docFile,       setDocFile]       = useState(null);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [subRoles,      setSubRoles]      = useState([]);
  const [uploading,     setUploading]     = useState(false);
  const [errorMsg,      setErrorMsg]      = useState('');
  const [successMsg,    setSuccessMsg]    = useState('');

  // ─── Early returns (after all hooks) ────────────────────────────────────
  if (!loading && profile?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  if (loading) {
    return <p className="p-6">Loading…</p>;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────
  const resetForm = () => {
    setTitle('');
    setContentType('text');
    setTextContent('');
    setLinkContent('');
    setPhotoFile(null);
    setDocFile(null);
    setSelectedRoles([]);
    setSubRoles([]);
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handlePhotoChange = e => setPhotoFile(e.target.files[0] || null);
  const handleDocChange   = e => setDocFile(e.target.files[0] || null);

  // ─── Publish Handler ────────────────────────────────────────────────────
  const handlePublish = async e => {
    e.preventDefault();
    setErrorMsg(''); setSuccessMsg('');

    if (!title.trim()) {
      setErrorMsg('Please enter a title.');
      return;
    }
    if (selectedRoles.length === 0) {
      setErrorMsg('Please select at least one role.');
      return;
    }
    if (selectedRoles.includes('telecallerGroup') && subRoles.length === 0) {
      setErrorMsg('Please select at least one sub‑role under Telecaller/Sales Manager.');
      return;
    }

    let finalContent = '';
    const finalType = contentType;
    try {
      if (contentType === 'text') {
        if (!textContent.trim()) throw new Error('Please enter some text.');
        finalContent = textContent.trim();

      } else if (contentType === 'link') {
        if (!linkContent.trim()) throw new Error('Please enter a valid URL.');
        finalContent = linkContent.trim();

      } else if (contentType === 'photo') {
        if (!photoFile) throw new Error('Please select a photo.');
        setUploading(true);
        const filename   = `bulletin_photo_${Date.now()}_${photoFile.name}`;
        const refStorage = storageRef(storage, `bulletin_photos/${filename}`);
        await uploadBytes(refStorage, photoFile);
        finalContent = await getDownloadURL(refStorage);
        setUploading(false);

      } else if (contentType === 'document') {
        if (!docFile) throw new Error('Please select a document file.');
        setUploading(true);
        const filename   = `bulletin_doc_${Date.now()}_${docFile.name}`;
        const refStorage = storageRef(storage, `bulletin_documents/${filename}`);
        await uploadBytes(refStorage, docFile);
        finalContent = await getDownloadURL(refStorage);
        setUploading(false);
      }

      await addDoc(collection(db, 'bulletins'), {
        title:       title.trim(),
        contentType: finalType,
        content:     finalContent,
        roles:       selectedRoles,
        subRoles,                    // ← new field
        createdAt:   serverTimestamp()
      });

      setSuccessMsg('Bulletin published successfully.');
      resetForm();

      // refresh the list
      const snap = await getDocs(collection(db, 'bulletins'));
      setBulletins(snap.docs.map(d => ({ id: d.id, ...d.data() })));

    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to publish bulletin.');
      setUploading(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-2xl mx-auto bg-white rounded shadow space-y-8">
      <h2 className="text-2xl font-bold">Publish & Manage Bulletins</h2>

      {/* Form */}
      <form onSubmit={handlePublish} className="space-y-6">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium">Title</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="mt-1 w-full border rounded px-3 py-2"
          />
        </div>
        {/* Content Type */}
        <div>
          <label className="block text-sm font-medium">Content Type</label>
          <select
            value={contentType}
            onChange={e => setContentType(e.target.value)}
            className="mt-1 w-full border rounded p-2"
          >
            <option value="text">Text</option>
            <option value="link">Link (URL)</option>
            <option value="photo">Photo</option>
            <option value="document">Document (.doc/.docx)</option>
          </select>
        </div>
        {/* Text / Link / Photo / Document inputs (unchanged) */}

        {/* Conditional Inputs… */}
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
          {contentType === 'link' && (
            <div>
              <label className="block text-sm font-medium">URL</label>
              <input
                type="url"
                value={linkContent}
                onChange={e => setLinkContent(e.target.value)}
                placeholder="https://…"
                className="mt-1 w-full border-gray-300 rounded-md shadow-sm px-3 py-2"
              />
            </div>
          )}
          {contentType === 'photo' && (
            <div>
              <label className="block text-sm font-medium">Photo</label>
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
          {contentType === 'document' && (
            <div>
              <label className="block text-sm font-medium">Document</label>
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
          <div className="mt-1 grid grid-cols-2 gap-2">
            {ALL_ROLES.map(r => (
              <label key={r.value} className="inline-flex items-center space-x-2">
                <input
                  type="checkbox"
                  value={r.value}
                  checked={selectedRoles.includes(r.value)}
                  onChange={() => {
                    setErrorMsg('');
                    if (selectedRoles.includes(r.value)) {
                      setSelectedRoles(sr => sr.filter(x => x !== r.value));
                      if (r.value === 'telecallerGroup') {
                        setSubRoles([]);
                      }
                    } else {
                      setSelectedRoles(sr => [...sr, r.value]);
                    }
                  }}
                  className="form-checkbox h-4 w-4 text-indigo-600"
                />
                <span>{r.label}</span>
              </label>
            ))}
          </div>
        </div>
        {/* Sub‑roles */}
        {selectedRoles.includes('telecallerGroup') && (
          <div>
            <label className="block text-sm font-medium">
              Under Telecaller/Sales Manager, select:
            </label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {TELE_SUBROLES.map(sr => (
                <label key={sr.value} className="inline-flex items-center space-x-2">
                  <input
                    type="checkbox"
                    value={sr.value}
                    checked={subRoles.includes(sr.value)}
                    onChange={() => {
                      setErrorMsg('');
                      setSubRoles(s =>
                        s.includes(sr.value)
                          ? s.filter(x => x !== sr.value)
                          : [...s, sr.value]
                      );
                    }}
                    className="form-checkbox h-4 w-4 text-indigo-600"
                  />
                  <span>{sr.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        {/* Publish */}
        <button
          type="submit"
          disabled={uploading}
          className={`px-4 py-2 rounded text-white ${
            uploading ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'
          }`}
        >
          {uploading ? 'Publishing…' : 'Publish Bulletin'}
        </button>
        {errorMsg && <p className="text-red-600">{errorMsg}</p>}
      </form>

      {/* Existing bulletins */}
      <div className="border-t pt-6 space-y-4">
        <h3 className="text-xl font-semibold">Existing Bulletins</h3>
        {bulletins.map(b => (
          <div key={b.id} className="flex justify-between items-center p-4 bg-gray-50 rounded">
            <div>
              <p className="font-medium">{b.title}</p>
              <p className="text-sm text-gray-500">
                Visible to: {b.roles.join(', ')}
                {b.subRoles?.length > 0 && ` ( subRoles: ${b.subRoles.join(', ')} )`}
              </p>
            </div>
            <div className="space-x-2">
              <button
                onClick={async () => {
                  await deleteDoc(collection(db,'bulletins').doc(b.id));
                  setBulletins(bs => bs.filter(x => x.id !== b.id));
                }}
                className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
              >
                Delete
              </button>
              {/* you could add an “Edit” button that loads this bulletin into the form */}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
