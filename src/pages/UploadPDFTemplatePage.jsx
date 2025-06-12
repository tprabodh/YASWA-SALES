import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { storage, db } from '../firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, query, where, getDocs, setDoc, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

const TEMPLATE_TYPES = [
  { label: 'Pamphlet (1131×1600)', value: 'pamphlet', folder: 'brochures', accept: 'image/png,image/jpeg' },
  { label: 'Visiting Card (1051×602)', value: 'visitingCard', folder: 'cards', accept: 'image/png,image/jpeg' },
  { label: 'Collaboration Agreement', value: 'agreement', folder: 'agreements', accept: '.docx' }
];

export default function UploadPdfTemplatePage() {
  const [type, setType] = useState('');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [existing, setExisting] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const userRole = 'admin'; // replace with useUserProfile if needed

  useEffect(() => {
    if (!type) return;
    (async () => {
      setLoading(true);
      // fetch existing template of this type
      const q = query(collection(db, 'templates'), where('templateType', '==', type));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const docData = snap.docs[0];
        setExisting({ id: docData.id, ...docData.data() });
        setTitle(docData.data().name);
        setPreviewUrl(docData.data().url);
      } else {
        setExisting(null);
        setTitle('');
        setPreviewUrl('');
      }
      setFile(null);
      setLoading(false);
    })();
  }, [type]);

  const handleFileChange = e => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    if (f.type.startsWith('image/')) {
      const url = URL.createObjectURL(f);
      setPreviewUrl(url);
    } else {
      setPreviewUrl('');
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!type || !title || !file) return;
    setSaving(true);
    const tmpl = TEMPLATE_TYPES.find(t => t.value === type);
    const storageRef = ref(storage, `${tmpl.folder}/${type}.${file.name.split('.').pop()}`);

    // remove existing
    if (existing) {
      // delete storage object
      const oldRef = ref(storage, existing.storagePath);
      await deleteObject(oldRef).catch(() => {});
      // delete firestore doc
      await deleteDoc(doc(db, 'templates', existing.id));
    }

    // upload new
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);

    // save metadata
    const docRef = doc(collection(db, 'templates'));
    await setDoc(docRef, {
      name: title,
      templateType: type,
      storagePath: storageRef.fullPath,
      url,
      uploadedAt: serverTimestamp()
    });

    setExisting({ id: docRef.id, name: title, url, storagePath: storageRef.fullPath });
    setSaving(false);
  };

  if (userRole !== 'admin') return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full p-6">
        <h2 className="text-2xl font-bold mb-4">Upload PDF Template</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Template Type</label>
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              className="mt-1 w-full border rounded p-2"
            >
              <option value="">Select type…</option>
              {TEMPLATE_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          {type && (
            <>
              <div>
                <label className="block text-sm font-medium">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="mt-1 w-full border rounded p-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium">File</label>
                <input
                  type="file"
                  accept={TEMPLATE_TYPES.find(t=>t.value===type).accept}
                  onChange={handleFileChange}
                  className="mt-1 w-full"
                  required
                />
              </div>
              {previewUrl && TEMPLATE_TYPES.find(t=>t.value===type).accept.startsWith('image') && (
                <div className="mt-2">
                  <img src={previewUrl} alt="preview" className="max-w-xs max-h-48 border rounded" />
                </div>
              )}
              <div>
                <button
                  type="submit"
                  disabled={saving}
                  className={`px-4 py-2 rounded text-white ${saving ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  {existing ? 'Update' : 'Upload'} Template
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
