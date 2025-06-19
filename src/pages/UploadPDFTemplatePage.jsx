// src/pages/UploadPdfTemplatePage.jsx

import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { storage, db } from '../firebase';
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from 'firebase/storage';
import {
  collection,
  query,
  where,
  getDocs,
  setDoc,
  doc,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';

// ——— Built‑in template types ———
const BUILT_IN = [
  { label: 'Pamphlet (Brochure)',  value: 'brochure',     folder: 'brochures',  accept: 'image/png,image/jpeg' },
  { label: 'Visiting Card',        value: 'visitingCard', folder: 'cards',      accept: 'image/png,image/jpeg' },
  { label: 'Collab Agreement',     value: 'agreement',    folder: 'agreements', accept: '.docx' }
];

// ——— Role groups & simple roles ———
const ROLE_OPTIONS = [
  { label: 'Telecaller & Sales Manager', value: 'telecallerGroup' },
  { label: 'Educational Counselor',                   value: 'employee' },
  { label: 'Sales Associate',                  value: 'associate' },
  { label: 'Team Lead',                    value: 'manager' },
  { label: 'Senior Manager',              value: 'businessHead' },
 
  { label: 'Sales Head',                 value: 'salesHead' },
  { label: 'Business Development Consultant', value: 'businessDevelopmentConsultant' },
  { label: 'Admin',                      value: 'admin' },
];

export default function UploadPdfTemplatePage() {
  const [allTypes, setAllTypes]       = useState(BUILT_IN);
  const [type, setType]               = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [customValue, setCustomValue] = useState('');
  const [title, setTitle]             = useState('');
  const [roles, setRoles]             = useState([]);
  const [subRoles, setSubRoles]       = useState([]);
  const [file, setFile]               = useState(null);
  const [previewUrl, setPreviewUrl]   = useState('');
  const [existing, setExisting]       = useState(null);
  const [saving, setSaving]           = useState(false);

  // derive config for current `type`
  const cfg = allTypes.find(t => t.value === type) || {};

  // 1) Load any extra types from Firestore
  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, 'templates'));
      const distinct = new Set(snap.docs.map(d => d.data().templateType));
      const extras = Array.from(distinct)
        .filter(v => !BUILT_IN.some(b => b.value === v))
        .map(v => ({
          label: v,
          value: v,
          folder: 'agreements',
          accept: '.docx'
        }));
      setAllTypes([...BUILT_IN, ...extras]);
    })();
  }, []);

  // 2) When `type` changes, load existing template
  useEffect(() => {
    if (!type) {
      setExisting(null);
      setTitle('');
      setRoles([]);
      setSubRoles([]);
      setPreviewUrl('');
      setFile(null);
      return;
    }
    (async () => {
      const q = query(collection(db, 'templates'), where('templateType', '==', type));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const d = snap.docs[0];
        setExisting({ id: d.id, ...d.data() });
        setTitle(d.data().name);
        setRoles(d.data().roles || []);
        setSubRoles(d.data().subRoles || []);
        setPreviewUrl(d.data().url);
      } else {
        setExisting(null);
        setTitle('');
        setRoles([]);
        setSubRoles([]);
        setPreviewUrl('');
        setFile(null);
      }
    })();
  }, [type]);

  const handleFileChange = e => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    if (cfg.accept.startsWith('image') && f.type.startsWith('image')) {
      setPreviewUrl(URL.createObjectURL(f));
    } else {
      setPreviewUrl('');
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();
    // create a new type
    if (type === '__add_new__') {
      setAllTypes([
        ...allTypes,
        { label: customLabel, value: customValue, folder: 'agreements', accept: '.docx' }
      ]);
      setType(customValue);
      return;
    }

    // VALIDATIONS
    if (!type || !title.trim() || !file || roles.length === 0) {
      return alert('Please fill all fields.');
    }
    // if group selected, require at least one subRole
    if (roles.includes('telecallerGroup') && subRoles.length === 0) {
      return alert('Please select at least one sub‑role under Telecaller & Sales Manager.');
    }

    setSaving(true);
    // upload path
    const ext = file.name.split('.').pop();
    const path = `${cfg.folder}/${type}.${ext}`;
    const sref = ref(storage, path);

    // delete old
    if (existing) {
      await deleteObject(ref(storage, existing.storagePath)).catch(() => {});
      await deleteDoc(doc(db, 'templates', existing.id)).catch(() => {});
    }

    // upload new
    await uploadBytes(sref, file);
    const url = await getDownloadURL(sref);

    // save metadata, including both roles & subRoles
    const docRef = doc(collection(db, 'templates'));
    await setDoc(docRef, {
      name:         title.trim(),
      templateType: type,
      roles,
      subRoles,              // ← NEW
      storagePath: path,
      url,
      uploadedAt:  serverTimestamp()
    });

    setExisting({ id: docRef.id, name: title, templateType: type, roles, subRoles, storagePath: path, url });
    setSaving(false);
  };

  // replace this with your real admin check
  const userRole = 'admin';
  if (userRole !== 'admin') return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full p-6">
        <h2 className="text-2xl font-bold mb-6">Upload / Update Template</h2>
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* 1) Template Type */}
          <div>
            <label className="block text-sm font-medium mb-1">Template Type</label>
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              className="w-full border rounded p-2"
              required
            >
              <option value="">Select…</option>
              {allTypes.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
              <option value="__add_new__">+ Add New Type…</option>
            </select>
          </div>

          {/* 2) Add New Type inputs */}
          {type === '__add_new__' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium">New Type Label</label>
                <input
                  value={customLabel}
                  onChange={e => setCustomLabel(e.target.value)}
                  className="w-full border rounded p-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium">New Type Value (no spaces)</label>
                <input
                  value={customValue}
                  onChange={e => setCustomValue(e.target.value)}
                  className="w-full border rounded p-2"
                  required
                />
              </div>
              <button
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Create Type
              </button>
            </div>
          )}

          {/* 3) Real‑type selected */}
          {type && type !== '__add_new__' && (
            <>
              {/* Roles */}
              <div>
                <label className="block text-sm font-medium mb-1">Applicable Roles</label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLE_OPTIONS.map(r => (
                    <label key={r.value} className="inline-flex items-center space-x-2">
                      <input
                        type="checkbox"
                        value={r.value}
                        checked={roles.includes(r.value)}
                        onChange={e => {
                          const v = e.target.value;
                          setRoles(prev =>
                            prev.includes(v)
                              ? prev.filter(x => x !== v)
                              : [...prev, v]
                          );
                          // if unchecking the group, clear subRoles
                          if (v === 'telecallerGroup' && roles.includes('telecallerGroup')) {
                            setSubRoles([]);
                          }
                        }}
                        className="form-checkbox h-5 w-5 text-indigo-600"
                      />
                      <span className="text-sm">{r.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Sub‑roles (only when group is checked) */}
              {roles.includes('telecallerGroup') && (
                <div>
                  <label className="block text-sm font-medium mb-1">Sub‑Roles</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['telecaller','managerSales'].map(sr => (
                      <label key={sr} className="inline-flex items-center space-x-2">
                        <input
                          type="checkbox"
                          value={sr}
                          checked={subRoles.includes(sr)}
                          onChange={e => {
                            const v = e.target.value;
                            setSubRoles(prev =>
                              prev.includes(v)
                                ? prev.filter(x => x !== v)
                                : [...prev, v]
                            );
                          }}
                          className="form-checkbox h-5 w-5 text-indigo-600"
                        />
                        <span className="text-sm">
                          {sr === 'telecaller' ? 'Telecaller' : 'Sales Manager'}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full border rounded p-2"
                  required
                />
              </div>

              {/* File */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  {cfg.accept === '.docx' ? 'Upload .docx file' : 'Upload image file'}
                </label>
                <input
                  type="file"
                  accept={cfg.accept}
                  onChange={handleFileChange}
                  required
                  className="w-full"
                />
              </div>

              {/* Preview */}
              {previewUrl && cfg.accept.startsWith('image') && (
                <img
                  src={previewUrl}
                  alt="preview"
                  className="max-w-xs max-h-48 border rounded"
                />
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={saving}
                className={`px-5 py-2 rounded text-white ${
                  saving ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {existing ? 'Update' : 'Upload'} Template
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
