// src/pages/BulletinInputPage.jsx
import React, { useState, useEffect } from 'react';
import { Navigate }                   from 'react-router-dom';
import { useUserProfile }             from '../hooks/useUserProfile';
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  query,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { storage, db }                from '../firebase';
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL
} from 'firebase/storage';
import {
  DragDropContext,
  Droppable,
  Draggable
} from 'react-beautiful-dnd';

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
  const { profile, loading } = useUserProfile();

  // 1) Fetch existing bulletins (admin only), ordered by `order` asc
  const [bulletins, setBulletins] = useState([]);
  useEffect(() => {
    if (loading || !profile || profile.role !== 'admin') return;
    (async () => {
      const q = query(
        collection(db, 'bulletins'),
        orderBy('order', 'asc')
      );
      const snap = await getDocs(q);
      setBulletins(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    })();
  }, [loading, profile]);

  // Form state
  const [editingId,    setEditingId]    = useState(null);
  const [title,        setTitle]        = useState('');
  const [contentType,  setContentType]  = useState('text');
  const [textContent,  setTextContent]  = useState('');
  const [linkContent,  setLinkContent]  = useState('');
  const [photoFile,    setPhotoFile]    = useState(null);
  const [docFile,      setDocFile]      = useState(null);
  const [selectedRoles,setSelectedRoles]= useState([]);
  const [subRoles,     setSubRoles]     = useState([]);
  const [uploading,    setUploading]    = useState(false);
  const [errorMsg,     setErrorMsg]     = useState('');
  const [successMsg,   setSuccessMsg]   = useState('');

  // Guard: only admin
  if (!loading && profile?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  if (loading) {
    return <p className="p-6">Loading…</p>;
  }

  // Reset form (after publish or cancel edit)
  const resetForm = () => {
    setEditingId(null);
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

  // Load a bulletin into the form for editing
  const startEdit = b => {
    setEditingId(b.id);
    setTitle(b.title);
    setContentType(b.contentType);
    setTextContent(b.contentType === 'text' ? b.content : '');
    setLinkContent(b.contentType === 'link' ? b.content : '');
    setSelectedRoles(b.roles);
    setSubRoles(b.subRoles || []);
    setErrorMsg('');
    setSuccessMsg('');
  };

  // Upload helper
  const uploadAndGetURL = async (file, folder, prefix) => {
    const filename   = `${prefix}_${Date.now()}_${file.name}`;
    const refStorage = storageRef(storage, `${folder}/${filename}`);
    await uploadBytes(refStorage, file);
    return await getDownloadURL(refStorage);
  };

  // Publish or update
  const handlePublish = async e => {
    e.preventDefault();
    setErrorMsg(''); setSuccessMsg('');
    if (!title.trim()) {
      setErrorMsg('Please enter a title.');
      return;
    }
    if (!selectedRoles.length) {
      setErrorMsg('Please select roles.');
      return;
    }
    if (selectedRoles.includes('telecallerGroup') && !subRoles.length) {
      setErrorMsg('Please select at least one sub‑role.');
      return;
    }

    try {
      let finalContent = '';
      if (contentType === 'text') {
        if (!textContent.trim()) throw new Error('Enter text.');
        finalContent = textContent.trim();
      } else if (contentType === 'link') {
        if (!linkContent.trim()) throw new Error('Enter URL.');
        finalContent = linkContent.trim();
      } else if (contentType === 'photo') {
        if (!photoFile) throw new Error('Select a photo.');
        setUploading(true);
        finalContent = await uploadAndGetURL(photoFile, 'bulletin_photos', 'photo');
        setUploading(false);
      } else {
        if (!docFile) throw new Error('Select a document.');
        setUploading(true);
        finalContent = await uploadAndGetURL(docFile, 'bulletin_documents', 'doc');
        setUploading(false);
      }

      // Assign or preserve order
      let orderVal = bulletins.length;
      if (editingId) {
        const existing = bulletins.find(x => x.id === editingId);
        orderVal = existing.order;
      }

      if (editingId) {
        await updateDoc(doc(db, 'bulletins', editingId), {
          title, contentType, content: finalContent,
          roles: selectedRoles, subRoles, order: orderVal,
          updatedAt: serverTimestamp(),
        });
        setSuccessMsg('Updated.');
      } else {
        await addDoc(collection(db, 'bulletins'), {
          title, contentType, content: finalContent,
          roles: selectedRoles, subRoles, order: orderVal,
          createdAt: serverTimestamp(),
        });
        setSuccessMsg('Published.');
      }

      // Refresh list
      const snap = await getDocs(query(collection(db,'bulletins'), orderBy('order','asc')));
      setBulletins(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      resetForm();

    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Failed.');
      setUploading(false);
    }
  };

  // Delete handler
  const handleDelete = async id => {
    if (!window.confirm('Delete this bulletin?')) return;
    await deleteDoc(doc(db, 'bulletins', id));
    setBulletins(bs => bs.filter(b => b.id !== id));
  };

  // Drag & drop reordering
  const onDragEnd = async result => {
    if (!result.destination) return;
    const reordered = Array.from(bulletins);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    setBulletins(reordered);
    for (let i = 0; i < reordered.length; i++) {
      await updateDoc(doc(db, 'bulletins', reordered[i].id), { order: i });
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto bg-white rounded shadow space-y-8">
      <h2 className="text-2xl font-bold">
        {editingId ? 'Edit Bulletin' : 'Publish New Bulletin'}
      </h2>

      {errorMsg && <div className="text-red-600">{errorMsg}</div>}
      {successMsg && <div className="text-green-600">{successMsg}</div>}

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
            <option value="link">Link</option>
            <option value="photo">Photo</option>
            <option value="document">Document</option>
          </select>
        </div>

        {/* Conditional Inputs */}
        {contentType === 'text' && (
          <textarea
            rows={4}
            value={textContent}
            onChange={e => setTextContent(e.target.value)}
            className="w-full border p-2 rounded"
          />
        )}
        {contentType === 'link' && (
          <input
            type="url"
            value={linkContent}
            onChange={e => setLinkContent(e.target.value)}
            className="w-full border p-2 rounded"
          />
        )}
        {contentType === 'photo' && (
          <input
            type="file"
            accept="image/*"
            onChange={e => setPhotoFile(e.target.files[0])}
          />
        )}
        {contentType === 'document' && (
          <input
            type="file"
            accept=".doc,.docx"
            onChange={e => setDocFile(e.target.files[0])}
          />
        )}

        {/* Roles */}
        <div>
          <label className="block text-sm font-medium">Visible To</label>
          <div className="grid grid-cols-2 gap-2 mt-1">
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
                      if (r.value === 'telecallerGroup') setSubRoles([]);
                    } else {
                      setSelectedRoles(sr => [...sr, r.value]);
                    }
                  }}
                  className="form-checkbox"
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
              Under Telecaller/Sales Manager select:
            </label>
            <div className="grid grid-cols-2 gap-2 mt-1">
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
                    className="form-checkbox"
                  />
                  <span>{sr.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Publish / Update */}
        <div className="space-x-4">
          <button
            type="submit"
            disabled={uploading}
            className={`px-4 py-2 rounded text-white ${
              uploading ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {uploading ? 'Working…' : editingId ? 'Update' : 'Publish'}
          </button>
          {editingId && (
            <button
              onClick={resetForm}
              type="button"
              className="px-4 py-2 border rounded text-gray-700"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Manage & Reorder */}
      <div>
        <h3 className="text-xl font-semibold mb-4">Existing Bulletins</h3>
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable
            droppableId="bulletins"
            isDropDisabled={false}
            isCombineEnabled={false}
          >
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="space-y-2"
              >
                {bulletins.map((b, idx) => (
                  <Draggable key={b.id} draggableId={b.id} index={idx}>
                    {(prov) => (
                      <div
                        ref={prov.innerRef}
                        {...prov.draggableProps}
                        {...prov.dragHandleProps}
                        className="flex justify-between items-center p-4 bg-gray-50 rounded shadow-sm"
                      >
                        <div>
                          <p className="font-medium">{b.title}</p>
                          <p className="text-sm text-gray-500">
                            Roles: {b.roles.join(', ')}
                            {b.subRoles?.length > 0 && ` (sub: ${b.subRoles.join(', ')})`}
                          </p>
                        </div>
                        <div className="space-x-2">
                          <button
                            onClick={() => startEdit(b)}
                            className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(b.id)}
                            className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>
    </div>
  );
}
