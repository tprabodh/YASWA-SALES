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
    boldRole:   true,
    boldPhone:  false,
    nameSize:   40,
    roleSize:   36,
    phoneSize:  36,
    namePos:    [560, 105],
    rolePos:    [560, 155],
    phonePos:   [560, 205],
  },
  brochure: {
    color:      '#000000',
    fontFamily: 'sans-serif',
    boldName:   true,
    boldPhone:  false,
    nameSize:   38,
    phoneSize:  34,
    namePos:    [605, -80],
    phonePos:   [605, -30],
  },
};

// map internal roles to friendly labels
const ROLE_LABELS = {
  employee:                         'Education Counsellor',
  associate:                        'Sales Associate',
  businessDevelopmentConsultant:    'Business Development Consultant',
  telecaller:                       'Telecaller',
  manager:                          'Team Lead',
  businessHead:                     'Senior Manager',
  salesHead:                        'Sales Head',
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

        // always stamp name first
        ctx.fillStyle = cfg.color;
        ctx.font      = `${cfg.boldName ? 'bold ' : ''}${cfg.nameSize}px ${cfg.fontFamily}`;
        ctx.textAlign = 'left';
        const [nx, ny] = cfg.namePos;
        ctx.fillText(profile.name, nx, ny < 0 ? img.height + ny : ny);

        // if visiting card, stamp role and phone
        if (sel.templateType === 'visitingCard') {
          const roleLabel = ROLE_LABELS[profile.role] || profile.role;
          ctx.font = `${cfg.boldRole ? 'bold ' : ''}${cfg.roleSize}px ${cfg.fontFamily}`;
          const [rx, ry] = cfg.rolePos;
          ctx.fillText(roleLabel, rx, ry < 0 ? img.height + ry : ry);

          ctx.font = `${cfg.boldPhone ? 'bold ' : ''}${cfg.phoneSize}px ${cfg.fontFamily}`;
          const [px, py] = cfg.phonePos;
          ctx.fillText(profile.mobileNumber, px, py < 0 ? img.height + py : py);
        } else {
          // brochure: stamp phone only
          ctx.font = `${cfg.boldPhone ? 'bold ' : ''}${cfg.phoneSize}px ${cfg.fontFamily}`;
          const [px, py] = cfg.phonePos;
          ctx.fillText(profile.mobileNumber, px, py < 0 ? img.height + py : py);
        }

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
        employeeRole: ROLE_LABELS[profile.role] || profile.role,
        date:         today,
      });
      doc.render();

      const out = doc.getZip().generate({ type: 'blob' });
      saveAs(out, `${sel.templateType}_${profile.companyId}.docx`);
    } catch (err) {
      alert('Error generating document: ' + err.message);
    }
  };

 

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white shadow-lg rounded-lg max-w-md w-full p-6 space-y-6">
        <h2 className="text-2xl font-bold text-center">Your Personal Documents</h2>

        <div>
          <label className="block text-sm font-medium mb-1">Choose Document</label>
          <select
            value={sel?.id || ''}
            onChange={e => setSel(templates.find(t => t.id === e.target.value) || null)}
            className="w-full border rounded p-2"
          >
            <option value="">— Select —</option>
            {options.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
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
