// src/pages/DownloadsPage.jsx

import React, { useEffect, useState, useRef } from 'react';
import { saveAs }               from 'file-saver';
import PizZip                   from 'pizzip';
import Docxtemplater            from 'docxtemplater';
import { useUserProfile }       from '../hooks/useUserProfile';
import { db }                   from '../firebase';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';

const TEMPLATE_TYPES = [
  { label: 'Visiting Card',    value: 'visitingCard' },
  { label: 'Brochure',         value: 'brochure' },
  { label: 'Collab Agreement', value: 'agreement' }
];

export default function DownloadsPage() {
  const { profile, loading } = useUserProfile();
  const [type, setType]      = useState('');
  const [template, setTemplate] = useState(null);
  const canvasRef            = useRef();

  // Fetch the latest template whenever 'type' changes
  useEffect(() => {
    if (!type) return;
    (async () => {
      // map UI type → Firestore templateType
      const fsType =
        type === 'brochure'      ? 'pamphlet' :
        type === 'visitingCard'  ? 'visitingCard' :
        type === 'agreement'     ? 'agreement' :
        type;

      const q = query(
        collection(db, 'templates'),
        where('templateType', '==', fsType),
        orderBy('uploadedAt', 'desc'),
        limit(1)
      );
      const snap = await getDocs(q);
      console.log('[DownloadsPage] fetched templates:', snap.docs.map(d => d.data()));
      setTemplate(snap.docs[0]?.data() || null);
    })();
  }, [type]);

  if (loading) return <p className="p-6 text-center">Loading…</p>;
  if (!profile) return <p className="p-6 text-red-500">Not authorized.</p>;

  const handleDownload = async () => {
    if (!template) {
      return alert('No template uploaded yet.');
    }

    if (type === 'visitingCard' || type === 'brochure') {
      // draw image + text onto a hidden canvas
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = template.url;
      img.onload = () => {
        const canvas = canvasRef.current;
        canvas.width  = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        ctx.font = '24px sans-serif';
        ctx.fillStyle = '#000';

        if (type === 'visitingCard') {
          ctx.textAlign = 'right';
          ctx.fillText(profile.name, img.width - 10, 30);
          ctx.fillText(profile.companyId, img.width - 10, 60);
        } else {
          ctx.textAlign = 'left';
          ctx.fillText(profile.name, 10, img.height - 40);
          ctx.fillText(profile.companyId, 10, img.height - 10);
        }

        canvas.toBlob(blob => {
          saveAs(blob, `${type}_${profile.companyId}.png`);
        });
      };
      img.onerror = () => alert('Failed to load template image.');
    }

    if (type === 'agreement') {
      // fetch the .docx blob, replace placeholders, then download
      const res = await fetch(template.url);
      const arrayBuffer = await res.arrayBuffer();
      const zip = new PizZip(arrayBuffer);
      const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
      doc.setData({
        employeeName: profile.name,
        employeeId:   profile.companyId,
        employeeRole: profile.role
      });
      try {
        doc.render();
      } catch (e) {
        return alert('Error rendering document: ' + e.message);
      }
      const out = doc.getZip().generate({ type: 'blob' });
      saveAs(out, `Collab_Agreement_${profile.companyId}.docx`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white shadow-lg rounded-lg max-w-md w-full p-6 space-y-6">
        <h2 className="text-2xl font-bold text-center">Download Template</h2>

        {/* 1) Template type selector */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Select Template Type
          </label>
          <select
            value={type}
            onChange={e => setType(e.target.value)}
            className="w-full border rounded p-2"
          >
            <option value="">— pick one —</option>
            {TEMPLATE_TYPES.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* 2) Preview */}
        {template && (
          <div className="flex items-center space-x-4">
            {type === 'agreement' ? (
              <div className="flex-1">
                <p className="font-medium">{template.name}</p>
                <p className="text-xs text-gray-500">
                  Uploaded: {template.uploadedAt.toDate().toLocaleString()}
                </p>
              </div>
            ) : (
              <img
                src={template.url}
                alt="preview"
                className="w-24 h-24 object-cover rounded border"
              />
            )}
          </div>
        )}

        {/* hidden canvas for image manipulation */}
        <canvas ref={canvasRef} className="hidden" />

        {/* 3) Download button */}
        <button
          onClick={handleDownload}
          disabled={!template}
          className={`w-full py-2 rounded text-white transition ${
            template
              ? 'bg-indigo-600 hover:bg-indigo-700'
              : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          Download
        </button>
      </div>
    </div>
  );
}
