import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { Link } from 'react-router-dom';

import {
  doc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';


function generateId(designation, associatedWith, teachingSubject, state) {
  const designationMap = {
    'Lecturer/Professor/Teaching Staff': 'T',
    'Administrative/Admissions Staff': 'N',
    'Non Educational Industry': 'E',
  };

  const associatedWithMap = {
    'PU': 'P',
    'School': 'S',
    'Non Educational': 'E',
  };

  const subjectMap = {
    'Maths': 'M',
    'Physics': 'P',
    'Chemistry': 'C',
    'Biology': 'B',
    'Others' : 'E'
  };

  const stateMap = {
    'Andhra Pradesh': 'A',
    'Arunachal Pradesh': 'B',
    'Assam': 'C',
    'Bihar': 'D',
    'Chhattisgarh': 'E',
    'Goa': 'F',
    'Gujarat': 'G',
    'Haryana': 'H',
    'Himachal Pradesh': 'I',
    'Jharkhand': 'J',
    'Karnataka': 'K',
    'Kerala': 'L',
    'Madhya Pradesh': 'M',
    'Maharashtra': 'N',
    'Manipur': 'O',
    'Meghalaya': 'P',
    'Mizoram': 'Q',
    'Nagaland': 'R',
    'Odisha': 'S',
    'Punjab': 'T',
    'Rajasthan': 'U',
    'Sikkim': 'V',
    'Tamil Nadu': 'W',
    'Telangana': 'X',
    'Tripura': 'Y',
    'Uttar Pradesh': 'Z',
    'Uttarakhand': '%',
    'West Bengal': '@',
  };

  const firstChar = designationMap[designation] || '&';
  const secondChar = associatedWithMap[associatedWith] || '&';
  const thirdChar = subjectMap[teachingSubject] || 'E';
  const fourthChar = stateMap[state] || '&';

  const randomDigits = Array.from({ length: 4 }, () => Math.floor(Math.random() * 10)).join('');

  return `${firstChar}${secondChar}${thirdChar}${fourthChar}${randomDigits}`;
}


export default function LoginPage() {
  const [isNew, setIsNew] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  // Additional fields
  const [mobileNumber, setMobileNumber] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [aadharNumber, setAadharNumber] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [designation, setDesignation] = useState('');
  const [associatedWith, setAssociatedWith] = useState('');
  const [teachingSubject, setTeachingSubject] = useState('');
  const [residingState, setResidingState] = useState('');

  const navigate = useNavigate();

  const resetForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setConfirm('');
    setError('');
    setMobileNumber('');
    setWhatsappNumber('');
    setAadharNumber('');
    setBankAccountNumber('');
    setIfscCode('');
    setDesignation('');
    setAssociatedWith('');
    setTeachingSubject('');
    setResidingState('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isNew) {
      if (
        !name ||
        !email ||
        !password ||
        password !== confirm ||
        !mobileNumber ||
        !whatsappNumber ||
        !aadharNumber ||
        !bankAccountNumber ||
        !ifscCode ||
        !designation ||
        !associatedWith ||
        !teachingSubject ||
        !residingState
      ) {
        setError('Please fill all fields correctly.');
        return;
      }
    }

    try {
      let userCred;

      if (isNew) {
        userCred = await createUserWithEmailAndPassword(auth, email, password);
        const newRole = 'employee';
        const newCompanyId = generateId(designation, associatedWith, teachingSubject, residingState);

        await setDoc(doc(db, 'users', userCred.user.uid), {
          name,
          email,
          role: newRole,
          companyId: newCompanyId,
          supervisorId: null,
          mobileNumber,
          whatsappNumber,
          aadharNumber,
          bankAccountNumber,
          ifscCode,
          designation,
          associatedWith,
          teachingSubject,
          residingState,
          createdAt: serverTimestamp(),
        });

        alert(`Your employee code is: ${newCompanyId}`);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }

      resetForm();
      navigate('/reports');
    } catch (err) {
      console.error(err);
      setError(err.message);
    }
  };

  const statesOfIndia = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
    'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
    'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim',
    'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
    'West Bengal'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#8a1ccf]/80 to-[#8a1ccf]/60 flex items-center justify-center px-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-8 space-y-6">
        <h1 className="text-3xl font-bold text-center text-[#8a1ccf]">
          {isNew ? 'Sign Up' : 'Sign In'}
        </h1>

        {error && (
          <div className="bg-red-100 text-red-700 p-2 rounded text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isNew && (
            <>
              <div>
                <label className="block text-gray-700">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="mt-1 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8a1ccf]"
                />
              </div>

              <div>
                <label className="block text-gray-700">Mobile Number</label>
                <input
                  type="tel"
                  value={mobileNumber}
                  onChange={e => setMobileNumber(e.target.value)}
                  className="mt-1 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8a1ccf]"
                />
              </div>

              <div>
                <label className="block text-gray-700">WhatsApp Number</label>
                <input
                  type="tel"
                  value={whatsappNumber}
                  onChange={e => setWhatsappNumber(e.target.value)}
                  className="mt-1 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8a1ccf]"
                />
              </div>

              <div>
                <label className="block text-gray-700">Aadhar Number</label>
                <input
                  type="text"
                  value={aadharNumber}
                  onChange={e => setAadharNumber(e.target.value)}
                  className="mt-1 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8a1ccf]"
                />
              </div>

              <div>
                <label className="block text-gray-700">Bank Account Number</label>
                <input
                  type="text"
                  value={bankAccountNumber}
                  onChange={e => setBankAccountNumber(e.target.value)}
                  className="mt-1 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8a1ccf]"
                />
              </div>

              <div>
                <label className="block text-gray-700">IFSC Code</label>
                <input
                  type="text"
                  value={ifscCode}
                  onChange={e => setIfscCode(e.target.value)}
                  className="mt-1 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8a1ccf]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700">Designation</label>
                  <select
                    value={designation}
                    onChange={e => setDesignation(e.target.value)}
                    className="mt-1 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8a1ccf]"
                  >
                    <option value="">Select</option>
                    <option>Lecturer/Professor/Teaching Staff</option>
                    <option>Administrative/Admissions Staff</option>
                    <option>Non Educational Industry</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700">Associated With</label>
                  <select
                    value={associatedWith}
                    onChange={e => setAssociatedWith(e.target.value)}
                    className="mt-1 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8a1ccf]"
                  >
                    <option value="">Select</option>
                    <option>PU</option>
                    <option>School</option>
                    <option>Non Educational</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700">Teaching Subject</label>
                  <select
                    value={teachingSubject}
                    onChange={e => setTeachingSubject(e.target.value)}
                    className="mt-1 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8a1ccf]"
                  >
                    <option value="">Select</option>
                    <option>Physics</option>
                    <option>Maths</option>
                    <option>Biology</option>
                    <option>Chemistry</option>
                    <option>Others</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700">Residing State</label>
                  <select
                    value={residingState}
                    onChange={e => setResidingState(e.target.value)}
                    className="mt-1 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8a1ccf]"
                  >
                    <option value="">Select</option>
                    {statesOfIndia.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-gray-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="mt-1 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8a1ccf]"
              required
            />
          </div>

          <div>
            <label className="block text-gray-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="mt-1 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8a1ccf]"
              required
            />
          </div>

          <p className="text-right text-sm">
            <Link to="/forgot-password" className="text-[#8a1ccf] hover:underline">
              Forgot Password?
            </Link>
          </p>

          {isNew && (
            <div>
              <label className="block text-gray-700">Confirm Password</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                className="mt-1 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8a1ccf]}"
                required
              />
            </div>
          )}

          <button
            type="submit"
            className="w-full mt-4 bg-[#8a1ccf] text-white py-3 rounded-lg shadow hover:bg-[#7a1bbf] transition"
          >
            {isNew ? 'Register' : 'Login'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm">
          {isNew
            ? 'Already have an account? '
            : "New user? "}
          <button
            onClick={() => {
              resetForm();
              setIsNew(!isNew);
            }}
            className="text-[#8a1ccf] font-medium hover:underline"
          >
            {isNew ? 'Sign In' : 'Create one'}
          </button>
        </p>
      </div>
    </div>
  );
}