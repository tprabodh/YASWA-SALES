// src/pages/ProfilePage.jsx
import React, { useState, useEffect } from 'react';
import { Navigate }          from 'react-router-dom';
import { useUserProfile }    from '../hooks/useUserProfile';
import { doc, updateDoc }    from 'firebase/firestore';
import { db }                from '../firebase';

// Map internal roles to friendly labels
const roleLabels = {
  employee: 'Education Counsellor',
  associate: 'Sales Associate',
  manager: 'Team Lead',
  businessHead: 'Senior Manager',
  telecaller: 'Manager-Sales',
  salesHead: 'Sales Head',
  businessDevelopmentConsultant: 'Business Development Consultant'
};

export default function ProfilePage() {
  const { profile, loading } = useUserProfile();

  // Editable fields + originals
  const [phone, setPhone]       = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [aadhar, setAadhar]     = useState('');
  const [bank, setBank]         = useState('');
  const [ifsc, setIfsc]         = useState('');

  const [origPhone, setOrigPhone]       = useState('');
  const [origWhatsapp, setOrigWhatsapp] = useState('');
  const [origAadhar, setOrigAadhar]     = useState('');
  const [origBank, setOrigBank]         = useState('');
  const [origIfsc, setOrigIfsc]         = useState('');

  const [saving, setSaving] = useState(false);

  // Initialize form when profile loads
  useEffect(() => {
    if (!loading && profile) {
      const m = profile.mobileNumber || '';
      const w = profile.whatsappNumber || '';
      const a = profile.aadharNumber || '';
      const b = profile.bankAccountNumber || '';
      const i = profile.ifscCode || '';

      setPhone(m);
      setWhatsapp(w);
      setAadhar(a);
      setBank(b);
      setIfsc(i);

      setOrigPhone(m);
      setOrigWhatsapp(w);
      setOrigAadhar(a);
      setOrigBank(b);
      setOrigIfsc(i);
    }
  }, [loading, profile]);

  if (loading) return <p>Loading…</p>;
  if (!profile) return <Navigate to="/" replace />;

  // Dirty if anything changed
  const isDirty =
    phone !== origPhone ||
    whatsapp !== origWhatsapp ||
    aadhar !== origAadhar ||
    bank !== origBank ||
    ifsc !== origIfsc;

  const handleSave = async () => {
    if (!isDirty) return;
    setSaving(true);
    const userRef = doc(db, 'users', profile.uid);
    await updateDoc(userRef, {
      mobileNumber:   phone,
      whatsappNumber: whatsapp,
      aadharNumber:   aadhar,
      bankAccountNumber: bank,
      ifscCode:       ifsc
    });
    // Sync originals
    setOrigPhone(phone);
    setOrigWhatsapp(whatsapp);
    setOrigAadhar(aadhar);
    setOrigBank(bank);
    setOrigIfsc(ifsc);
    setSaving(false);
    alert('Profile updated.');
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden">
        <div className="p-8">
          <br /><br />
          <h2 className="text-3xl font-extrabold text-[#8a1ccf] mb-6 text-center">
            My Profile
          </h2>

          {/* Read-only fields */}
          <div className="space-y-4 mb-8">
            <div>
              <label className="block text-sm font-medium text-gray-600">Name</label>
              <p className="mt-1 text-lg font-medium text-gray-800">{profile.name}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600">Role</label>
              <p className="mt-1 text-lg font-medium text-gray-800">
                {roleLabels[profile.role] || profile.role}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600">Email</label>
              <p className="mt-1 text-lg font-medium text-gray-800">{profile.email}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600">Consultant ID</label>
              <p className="mt-1 text-lg font-medium text-gray-800">{profile.companyId}</p>
            </div>
          </div>

          {/* Editable fields */}
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-600">Phone</label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="mt-1 block w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600">WhatsApp Number</label>
              <input
                type="text"
                value={whatsapp}
                onChange={e => setWhatsapp(e.target.value)}
                className="mt-1 block w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600">Aadhar Number</label>
              <input
                type="text"
                value={aadhar}
                onChange={e => setAadhar(e.target.value)}
                className="mt-1 block w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600">Bank Account Number</label>
              <input
                type="text"
                value={bank}
                onChange={e => setBank(e.target.value)}
                className="mt-1 block w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600">IFSC Code</label>
              <input
                type="text"
                value={ifsc}
                onChange={e => setIfsc(e.target.value)}
                className="mt-1 block w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
          </div>

          {/* Save button */}
          <div className="mt-8 text-center">
            <button
              onClick={handleSave}
              disabled={!isDirty || saving}
              className={`px-6 py-3 rounded-full text-white font-semibold transition ${
                !isDirty || saving
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
