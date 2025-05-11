import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
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
    <div className="login-container">
      <h1>{isNew ? 'Sign Up' : 'Sign In'}</h1>

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit}>
        {isNew && (
          <>
            <label>Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <label>Mobile Number</label>
            <input
              type="tel"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              required
            />

            <label>WhatsApp Number</label>
            <input
              type="tel"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              required
            />

            <label>Aadhar Number</label>
            <input
              type="text"
              value={aadharNumber}
              onChange={(e) => setAadharNumber(e.target.value)}
              required
            />

            <label>Bank Account Number</label>
            <input
              type="text"
              value={bankAccountNumber}
              onChange={(e) => setBankAccountNumber(e.target.value)}
              required
            />

            <label>IFSC Code</label>
            <input
              type="text"
              value={ifscCode}
              onChange={(e) => setIfscCode(e.target.value)}
              required
            />

            <label>Current Designation</label>
            <select
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              required
            >
              <option value="">Select</option>
              <option value="Lecturer/Professor/Teaching Staff">Lecturer/Professor/Teaching Staff</option>
              <option value="Administrative/Admissions Staff">Administrative/Admissions Staff</option>
              <option value="Non Educational Industry">Non Educational Industry</option>
            </select>

            <label>Associated With</label>
            <select
              value={associatedWith}
              onChange={(e) => setAssociatedWith(e.target.value)}
              required
            >
              <option value="">Select</option>
              <option value="PU">PU</option>
              <option value="School">School</option>
              <option value="Non Educational">Non Educational</option>
            </select>

            <label>Teaching Subject</label>
            <select
              value={teachingSubject}
              onChange={(e) => setTeachingSubject(e.target.value)}
              required
            >
              <option value="">Select</option>
              <option value="Physics">Physics</option>
              <option value="Maths">Maths</option>
              <option value="Biology">Biology</option>
              <option value="Chemistry">Chemistry</option>
              <option value="Others">Others</option>

            </select>

            <label>Residing State</label>
            <select
              value={residingState}
              onChange={(e) => setResidingState(e.target.value)}
              required
            >
              <option value="">Select</option>
              {statesOfIndia.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </>
        )}

        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {isNew && (
          <>
            <label>Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </>
        )}

        <button type="submit">
          {isNew ? 'Register' : 'Login'}
        </button>
      </form>

      <button
        className="toggle-button"
        onClick={() => {
          resetForm();
          setIsNew(!isNew);
        }}
      >
        {isNew
          ? 'Already have an account? Sign In'
          : 'New user? Create an account'}
      </button>
    </div>
  );
}
