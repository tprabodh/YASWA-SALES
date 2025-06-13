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
  getDocs,
} from 'firebase/firestore';

const STAMP_CONFIG_DEFAULT = {
  visitingCard: {
    color:      '#ffffff',
    fontFamily: 'sans-serif',
    boldName:   true,
    boldId:     true,
    nameSize:   40,
    idSize:     36,
    namePos:    [560, 105],
    idPos:      [560, 155],
  },
  brochure: {
    color:      '#000000',
    fontFamily: 'sans-serif',
    boldName:   true,
    boldId:     false,
    nameSize:   38,
    idSize:     34,
    namePos:    [605, -80],
    idPos:      [605, -30],
  },
};

export default function DownloadsPage() {
  const { profile, loading }      = useUserProfile();
  const [templates, setTemplates] = useState([]);
  const [sel, setSel]             = useState(null);
  const [stampConfig, setStampConfig] = useState(STAMP_CONFIG_DEFAULT);
  const canvasRef                 = useRef();

  // load all templates once
  useEffect(() => {
    (async () => {
      const snap = await getDocs(
        query(collection(db, 'templates'), orderBy('uploadedAt', 'desc'))
      );
      setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    })();
  }, []);

  if (loading)    return <p className="p-6 text-center">Loading…</p>;
  if (!profile)   return <p className="p-6 text-red-500">Not authorized.</p>;

  // only show templates that include this role
  const options = templates.filter(t => t.roles?.includes(profile.role));

  const handleDownload = async () => {
    if (!sel) return;

    // IMAGE TEMPLATES
    if (sel.templateType === 'visitingCard' || sel.templateType === 'brochure') {
      const cfg = stampConfig[sel.templateType] || STAMP_CONFIG_DEFAULT[sel.templateType];
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = sel.url;
      img.onload = () => {
        const c = canvasRef.current;
        c.width  = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);

        // name stamp
        ctx.fillStyle = cfg.color;
        ctx.font      = `${cfg.boldName ? 'bold ' : ''}${cfg.nameSize}px ${cfg.fontFamily}`;
        ctx.textAlign = 'left';
        const [nx, ny] = cfg.namePos;
        ctx.fillText(
          profile.name,
          nx,
          ny < 0 ? img.height + ny : ny
        );

        // id stamp
        ctx.font = `${cfg.boldId ? 'bold ' : ''}${cfg.idSize}px ${cfg.fontFamily}`;
        const [ix, iy] = cfg.idPos;
        ctx.fillText(
          profile.companyId,
          ix,
          iy < 0 ? img.height + iy : iy
        );

        c.toBlob(blob => {
          saveAs(blob, `${sel.templateType}_${profile.companyId}.png`);
        });
      };
      img.onerror = () => alert('Failed to load image template.');
      return;
    }

    // DOCX templates (agreements, etc.)
    try {
      const res = await fetch(sel.url);
      const buf = await res.arrayBuffer();
      const zip = new PizZip(buf);
      const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

      // format today’s date as dd-mm-yyyy
      const d = new Date();
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      const today = `${dd}-${mm}-${yyyy}`;

      doc.setData({
        employeeName: profile.name,
        employeeId:   profile.companyId,
        employeeRole: profile.role,
        date:         today,
      });
      doc.render();

      const out = doc.getZip().generate({ type: 'blob' });
      saveAs(out, `${sel.templateType}_${profile.companyId}.docx`);
    } catch (err) {
      alert('Error generating document: ' + err.message);
    }
  };

  // only show templates allowed for this user
  const renderConfigControls = () => {
    if (!sel) return null;
    const type = sel.templateType;
    if (type !== 'visitingCard' && type !== 'brochure') return null;
    const cfg = stampConfig[type];
    return (
      <div className="space-y-2">
        <h3 className="font-medium">Stamp Settings ({type})</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm">Name font size</label>
            <input
              type="number"
              value={cfg.nameSize}
              onChange={e => setStampConfig(s => ({
                ...s,
                [type]: { ...s[type], nameSize: +e.target.value }
              }))}
              className="w-full border rounded p-1"
            />
          </div>
          <div>
            <label className="block text-sm">ID font size</label>
            <input
              type="number"
              value={cfg.idSize}
              onChange={e => setStampConfig(s => ({
                ...s,
                [type]: { ...s[type], idSize: +e.target.value }
              }))}
              className="w-full border rounded p-1"
            />
          </div>
          <div>
            <label className="block text-sm">Font family</label>
            <input
              type="text"
              value={cfg.fontFamily}
              onChange={e => setStampConfig(s => ({
                ...s,
                [type]: { ...s[type], fontFamily: e.target.value }
              }))}
              className="w-full border rounded p-1"
            />
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={cfg.boldName}
              onChange={e => setStampConfig(s => ({
                ...s,
                [type]: { ...s[type], boldName: e.target.checked }
              }))}
            />
            <label className="text-sm">Bold Name</label>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={cfg.boldId}
              onChange={e => setStampConfig(s => ({
                ...s,
                [type]: { ...s[type], boldId: e.target.checked }
              }))}
            />
            <label className="text-sm">Bold ID</label>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white shadow-lg rounded-lg max-w-md w-full p-6 space-y-6">
        <h2 className="text-2xl font-bold text-center">Download Template</h2>

        <div>
          <label className="block text-sm font-medium mb-1">
            Choose:
          </label>
          <select
            value={sel?.id || ''}
            onChange={e =>
              setSel(templates.find(t => t.id === e.target.value) || null)
            }
            className="w-full border rounded p-2"
          >
            <option value="">— select a template —</option>
            {options.map(t => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.templateType})
              </option>
            ))}
          </select>
        </div>

        {sel && (
          <div className="flex items-center space-x-4 p-4 bg-gray-100 rounded">
            {(sel.templateType === 'visitingCard' || sel.templateType === 'brochure') ? (
              <img
                src={sel.url}
                alt="preview"
                className="w-24 h-24 object-cover rounded border"
              />
            ) : (
              <div className="flex items-center space-x-2 text-gray-600">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6 2a2 2 0 00-2 …" />
                </svg>
                <span className="text-sm">DOCX</span>
              </div>
            )}
            <div className="flex-1">
              <p className="font-medium">{sel.name}</p>
              <p className="text-xs text-gray-500">
                Uploaded: {sel.uploadedAt.toDate().toLocaleString()}
              </p>
            </div>
          </div>
        )}

        

        <canvas ref={canvasRef} className="hidden" />

        <button
          onClick={handleDownload}
          disabled={!sel}
          className={`w-full py-2 rounded text-white transition ${
            sel
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
