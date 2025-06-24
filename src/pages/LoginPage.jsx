// src/pages/LoginPage.jsx

import React, { useState } from 'react';
import { useUserProfile } from '../hooks/useUserProfile';
import { useNavigate }                 from 'react-router-dom';
import { auth, db }                    from '../firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
} from 'firebase/auth';
import { Link }                        from 'react-router-dom';

import {
  collection,
  doc,
  setDoc,
  serverTimestamp,
  getDocs,
  query,
  where,
  updateDoc,
  arrayUnion
} from 'firebase/firestore';

// React‐Toastify imports:
import { toast, ToastContainer }       from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Modal from 'react-modal';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';

// Helper: zero‐pad a number to 4 digits (e.g. 1 → "0001", 42 → "0042")
function zeroPad4(n) {
  return String(n).padStart(4, '0');
}

// Generate next "YSA-<PREFIX>-<XXXX>" by scanning all existing users:
async function generateNextCompanyId(prefix) {
  const usersSnap = await getDocs(collection(db, 'users'));
  let maxNumber = 0;

  usersSnap.forEach((docSnap) => {
    const cid            = docSnap.data().companyId || '';
    const expectedPrefix = `YSA-${prefix}-`;
    if (cid.startsWith(expectedPrefix) && cid.length === expectedPrefix.length + 4) {
      const suffixStr = cid.slice(expectedPrefix.length);
      const num       = parseInt(suffixStr, 10);
      if (!isNaN(num) && num > maxNumber) {
        maxNumber = num;
      }
    }
  });

  const nextNumber = maxNumber + 1;
  return `YSA-${prefix}-${zeroPad4(nextNumber)}`;
}

// Assign a new user under a "dummy" manager. Only managers with isDummy==true count.
// If none exist (or they’re full), create a brand‐new dummy.
async function assignUnderDummyManager(newUserCompanyId) {
  // 1) Query only dummy managers:
  const mgrQuery = query(
    collection(db, 'users'),
    where('role', '==', 'manager'),
    where('isDummy', '==', true)
  );
  const mgrSnap = await getDocs(mgrQuery);

  let chosenManagerDoc  = null;
  let chosenManagerData = null;

  // 2) Pick first dummy with fewer than 25 subordinates:
  for (let mDoc of mgrSnap.docs) {
    const data = mDoc.data();
    const subs = Array.isArray(data.subordinates) ? data.subordinates : [];
    if (subs.length < 25) {
      chosenManagerDoc  = mDoc;
      chosenManagerData = data;
      break;
    }
  }

  if (!chosenManagerDoc) {
    // 3) No dummy with free slot → create a new dummy manager:
    const newMgrCompanyId = await generateNextCompanyId('YL');
    const dummyName       = `AutoManager_${newMgrCompanyId}`;
    const dummyEmail      = `auto-mgr-${newMgrCompanyId}@example.com`;

    const dummyRef = doc(collection(db, 'users'));
    await setDoc(dummyRef, {
      name:         dummyName,
      email:        dummyEmail,
      role:         'manager',
      companyId:    newMgrCompanyId,
      supervisorId: null,
      subordinates: [],
      isDummy:      true,
      createdAt:    serverTimestamp()
    });

    chosenManagerDoc  = { id: dummyRef.id, ref: dummyRef };
    chosenManagerData = { companyId: newMgrCompanyId, subordinates: [] };
  }

  // 4) Push our newUserCompanyId into that manager’s subordinates:
  const mgrRef = doc(db, 'users', chosenManagerDoc.id);
  await updateDoc(mgrRef, {
    subordinates: arrayUnion(newUserCompanyId)
  });

  return chosenManagerData.companyId;
}

// pulled‐out registration logic
// pulled‑out registration logic
// now expects newRole & prefix in its params
async function doActualRegistration({
  name,
  email,
  password,
  mobileNumber,
  whatsappNumber,
  aadharNumber,
  bankAccountNumber,
  ifscCode,
  residingState,
  position,
  designation,
  associatedWith,
  teachingSubject,
  newRole,    // ← the role string from positionOptions
  prefix      // ← the company‑ID prefix from positionOptions
}) {
  // 1) create the Firebase Auth user
  const userCred = await createUserWithEmailAndPassword(auth, email, password);

  // 2) generate a sequential YSA‑<PREFIX>-000X
  const newCompanyId = await generateNextCompanyId(prefix);

  // 3) if this is an employee/associate/BDC, auto‑assign under a dummy manager
  let supervisorId = null;
  if (['employee','associate','businessDevelopmentConsultant'].includes(newRole)) {
    supervisorId = await assignUnderDummyManager(newCompanyId);
  }

  // 4) build your Firestore payload
  const userDoc = {
    name,
    email,
    role:            newRole,
    companyId:       newCompanyId,
    mobileNumber,
    whatsappNumber,
    aadharNumber:    aadharNumber || null,
    bankAccountNumber,
    ifscCode,
    residingState:   residingState || null,
    supervisorId,
    subordinates:    [],
    isDummy:         false,
    createdAt:       serverTimestamp(),
    position
  };
  if (position === 'officer') {
    userDoc.designation     = designation;
    userDoc.associatedWith  = associatedWith;
    userDoc.teachingSubject = teachingSubject;
  }

  // 5) write to Firestore
  await setDoc(doc(db, 'users', userCred.user.uid), userDoc);

  // 6) notify
  toast.success(
    `Registration successful! Your Company ID: ${newCompanyId}`,
    { position: 'top-center', autoClose: 4000 }
  );
}


export default function LoginPage() {
  const { profile, loading: authLoading } = useUserProfile();
  const navigate = useNavigate();

  // form state
  const [isNew,             setIsNew]              = useState(false);
  const [position,          setPosition]           = useState('');
  const [name,              setName]               = useState('');
  const [email,             setEmail]              = useState('');
  const [password,          setPassword]           = useState('');
  const [confirm,           setConfirm]            = useState('');
  const [mobileNumber,      setMobileNumber]       = useState('');
  const [whatsappNumber,    setWhatsappNumber]     = useState('');
  const [aadharNumber,      setAadharNumber]       = useState('');
  const [bankAccountNumber, setBankAccountNumber]  = useState('');
  const [ifscCode,          setIfscCode]           = useState('');
  const [residingState,     setResidingState]      = useState('');
  const [designation,       setDesignation]        = useState('');
  const [associatedWith,    setAssociatedWith]     = useState('');
  const [teachingSubject,   setTeachingSubject]    = useState('');

  const [errors,            setErrors]             = useState({});
  const [error,             setError]              = useState('');
  const [pendingRegistration, setPendingRegistration] = useState(null);
  const [showDeclaration,   setShowDeclaration]    = useState(false);
  const [showTour,          setShowTour]           = useState(false);
  const [showWelcome,       setShowWelcome]        = useState(false);

  // new: show/hide password toggles
  const [showPwd,           setShowPwd]            = useState(false);
  const [showConfirmPwd,    setShowConfirmPwd]     = useState(false);
    const [loadingReg, setLoadingReg] = useState(false); // loading overlay


  // Dropdown options
  const positionOptions = [
    { label: "Educational Counselor(LECTURER)",              value: "officer",       role: "employee",                       prefix: "EC" },
    { label: "Telecaller",                       value: "telecaller",    role: "telecaller",                     prefix: "TC" },
        { label: "Manager-Sales",                       value: "managerSales",    role: "telecaller",                     prefix: "TC" },
    { label: "Team Lead",                    value: "manager",       role: "manager",                        prefix: "TL" },
   /* { label: "Business Head",                    value: "businessHead",  role: "businessHead",                   prefix: "YH" },
        { label: "Sales Head",     value: "salesHead",     role: "salesHead",                      prefix: "SH" }, */

    { label: "Sales Associate(FRESHER)",                  value: "associate",     role: "associate",                      prefix: "SA" },
    { label: "Business Development Consultant",          value: "bdConsultant",  role: "businessDevelopmentConsultant",  prefix: "BC" },
  ];


  const statesOfIndia = [
    'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
    'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra',
    'Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim',
    'Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal'
  ];

   const resetForm = () => {
    setName(''); setEmail(''); setPassword(''); setConfirm('');
    setMobileNumber(''); setWhatsappNumber(''); setAadharNumber('');
    setBankAccountNumber(''); setIfscCode(''); setResidingState('');
    setPosition(''); setDesignation(''); setAssociatedWith('');
    setTeachingSubject(''); setErrors({}); setError('');
  };

  // 1️⃣ Login flow
 async function handleLoginAttempt() {
    setError('');
    if (!email.trim() || !password) {
      setError('Please enter both email and password.');
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setShowWelcome(true);
    } catch (err) {
      setError(err.message);
    }
  }

  // 2️⃣ Register flow
 async function handleRegisterAttempt() {
    setError('');
    const trimmedEmail = email.trim();
    const methods = await fetchSignInMethodsForEmail(auth, trimmedEmail);
    if (methods.length > 0) {
  setErrors(prev => ({ ...prev, email: true }));
  setError('Email already in use. Please try with a new email.');
  return;
}

// 0b) Prevent duplicate mobile in Firestore:
  const mobileSnap = await getDocs(
      query(collection(db, 'users'), where('mobileNumber', '==', mobileNumber.trim()))
    );
    if (!mobileSnap.empty) {
      setErrors(prev => ({ ...prev, mobileNumber: true }));
      setError('This mobile number is already in use.');
      return;
    }
        const newErrors = {};


    // 1) Position
    if (!position) newErrors.position = true;

    // 2) Name / Email / Password / Confirm
    if (!name.trim())       newErrors.name     = true;
    if (!email.trim())      newErrors.email    = true;
    if (!password)          newErrors.password = true;
    if (!confirm)           newErrors.confirm  = true;
    if (password && confirm && password !== confirm) {
      newErrors.password = newErrors.confirm = true;
    }
    // email format
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = true;
    }
    // mobile & whatsapp 10 digits
    if (!/^\d{10}$/.test(mobileNumber))   newErrors.mobileNumber   = true;
    if (!/^\d{10}$/.test(whatsappNumber)) newErrors.whatsappNumber = true;
    // bank 9–18 digits
    if (!/^\d{9,18}$/.test(bankAccountNumber)) newErrors.bankAccountNumber = true;
    // ifsc 11 alphanum
// 4 letters, then a literal "0", then 6 digits
if (!/^[A-Za-z]{4}0\d{6}$/.test(ifscCode)) newErrors.ifscCode = true;
    // officer extras…
    if (position === 'officer') {
      if (!/^\d+$/.test(aadharNumber || '')) newErrors.aadharNumber = true;
      if (!designation)      newErrors.designation    = true;
      if (!associatedWith)   newErrors.associatedWith = true;
      if (!teachingSubject)  newErrors.teachingSubject= true;
      if (!residingState)    newErrors.residingState  = true;
    }

    

    // bail on validation errors
     if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setError('Please correct the highlighted fields.');
      return;
    }

    // stash for declaration
     const cfg = positionOptions.find(o => o.value === position) || {};
    setPendingRegistration({
      position, name, email: trimmedEmail, password,
      mobileNumber, whatsappNumber, aadharNumber,
      bankAccountNumber, ifscCode, residingState,
      designation, associatedWith, teachingSubject,
      newRole: cfg.role, prefix: cfg.prefix,
    });
    setShowDeclaration(true);
  }



function handleSubmit(e) {
    e.preventDefault();
    isNew ? handleRegisterAttempt() : handleLoginAttempt();
  }


  // Whenever the user blurs the mobile‐number field, if WhatsApp is empty, ask if we should copy it:
  const handleMobileBlur = () => {
    if (!whatsappNumber.trim() && mobileNumber.trim()) {
      if (window.confirm("Is your WhatsApp number the same as your Mobile number?")) {
        setWhatsappNumber(mobileNumber);
        setErrors(prev => ({ ...prev, whatsappNumber: false }));
      }
    }
  };

 return (
    // Main container: Flex column to stack heading and form card vertically.
    // items-center centers them horizontally. justify-center centers vertically.
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-[#8a1ccf] to-[#8a1ccf]/90 py-8 px-4">

      {/* Heading: Centered with margin-bottom for spacing. */}
      <h1 className="text-5xl font-extrabold text-white text-center mb-6">
        Welcome to Yaswa Sales
      </h1>

      {/* Loading overlay during actual registration/login */}
      {loadingReg && (
        <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-50">
          <div className="text-center">
            <p className="text-lg font-semibold mb-2">
              Generating your offer letter, Visiting card, Brochure...
            </p>
            <div className="loader ease-linear rounded-full border-8 border-t-8 border-gray-200 h-16 w-16 mx-auto" />
          </div>
        </div>
      )}
         <Modal
  isOpen={showDeclaration}
  onRequestClose={() => setShowDeclaration(false)}
  className="max-w-md mx-auto mt-20 bg-white p-6 rounded shadow-lg"
  overlayClassName="fixed inset-0 bg-black bg-opacity-50"
>
  <h3 className="text-xl font-bold mb-4">Declaration</h3>
  <p className="mb-6 whitespace-pre-line">
    {`I hereby declare that I am above 18 years of age and that I am legally competent to enter into this Collaboration Agreement. I voluntarily agree to collaborate with Yaswa Academy and to be bound by its terms and conditions, as may be amended from time to time.`}
  </p>
  <div className="flex justify-end space-x-2">
    <button
      onClick={() => {
        setShowDeclaration(false);
        setPendingRegistration(null);
      }}
      className="px-4 py-2 bg-red-600 rounded"
    >Don't Agree & Cancel</button>
    <button
      onClick={() => {
       setShowDeclaration(false);
    setShowTour(true);
      }}
      className="px-4 py-2 bg-green-600 text-white rounded"
    >Agree & Register Now</button>
  </div>
</Modal>


<Modal
  isOpen={showTour}
  onRequestClose={() => setShowTour(false)}
  className="max-w-lg mx-auto mt-20 bg-white p-6 rounded shadow-lg"
  overlayClassName="fixed inset-0 bg-black bg-opacity-50"
>
  <h3 className="text-xl font-bold mb-4">Fast Tour</h3>
 <ul className="list-disc pl-5 text-gray-700 mb-6">
    <p>
      <strong>1.Download from "Personal Documents" Tab</strong>
    <li>Offer Letter</li>
    <li>Visiting Card</li>
    <li>Posters, Flyers & Social Media Creatives (with your name & number)</li>
    </p>
    
     <p>
      <strong>2.	Go to "Training Module" Tab</strong>
    <li>Product & Sales PDFs</li>
    <li>Training YouTube Links</li>
    </p>

     <p>
      <strong>3.	Portal Training Videos</strong>
    <li>Watch on YouTube to learn how to use the app effectively</li>
    </p>

     <p>
      <strong>4.	Daily Live Training</strong>
    <li>Learn about the company, product, and how to achieve your monthly goals</li>
    </p>

    <p>You're all set to begin.
Stay consistent. Sell smart. Grow fast.</p>
     </ul>
   <button
          onClick={async () => {
            setShowTour(false);
            setLoadingReg(true);
            try {
              await doActualRegistration(pendingRegistration);
              await signInWithEmailAndPassword(auth,
                pendingRegistration.email,
                pendingRegistration.password
              );
              navigate('/home');
            } catch (err) {
              setError('Email already in use. Please try with a new email.');
            } finally {
              setLoadingReg(false);
              setPendingRegistration(null);
            }
          }}
          className="px-4 py-2 bg-[#8a1ccf] text-white rounded"
        >
          Got it!
        </button>
</Modal>


<Modal
  isOpen={showWelcome}
  onRequestClose={() => {
    setShowWelcome(false);
    navigate('/profile');
  }}
  className="max-w-sm mx-auto mt-20 bg-white p-6 rounded shadow-lg"
  overlayClassName="fixed inset-0 bg-black bg-opacity-50"
>
  <h3 className="text-xl font-bold mb-4">Welcome!  </h3>
  {profile ? (
  <ul className="list-disc pl-5 text-gray-700 mb-6">
    <p>
      <strong>1.Download from "Personal Documents" Tab</strong>
    <li>Offer Letter</li>
    <li>Visiting Card</li>
    <li>Posters, Flyers & Social Media Creatives (with your name & number)</li>
    </p>
    
     <p>
      <strong>2.	Go to "Training Module" Tab</strong>
    <li>Product & Sales PDFs</li>
    <li>Training YouTube Links</li>
    </p>

     <p>
      <strong>3.	Portal Training Videos</strong>
    <li>Watch on YouTube to learn how to use the app effectively</li>
    </p>

     <p>
      <strong>4.	Daily Live Training</strong>
    <li>Learn about the company, product, and how to achieve your monthly goals</li>
    </p>

    <p>You're all set to begin.
Stay consistent. Sell smart. Grow fast.</p>
     </ul>  ) : (
    <p className="mb-6">Welcome to Yaswa Sales!</p>
  )}
  <button
    onClick={() => {
      setShowWelcome(false);
      navigate('/home');
    }}
    className="px-4 py-2 bg-[#8a1ccf] text-white rounded hover:bg-indigo-800 "
  >
    Let’s Go
  </button>
</Modal>

      {/* White container for the form and illustration. Responsive width. */}
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full flex overflow-hidden">
        {/* Left half: heading + form */}
        <div className="w-full md:w-1/2 max-h-[90vh] overflow-y-auto p-8">
          <ToastContainer />
          <h1 className="text-3xl font-bold text-center text-[#8a1ccf]">
            {isNew ? 'Register' : 'Sign In'}
          </h1>

          {error && (
            <div className="bg-red-100 text-red-700 p-2 my-4 rounded text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4 mt-4">
            {isNew && (
              <>
                {/* Position */}
                <div>
                  <label className="block text-gray-700">Position</label>
                  <select
                    value={position}
                    onChange={e => {
                      setPosition(e.target.value);
                      setErrors(prev => ({ ...prev, position: false }));
                    }}
                    className={`mt-1 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8a1ccf] ${errors.position ? 'border-red-500' : 'border-gray-300'}`}
                  >
                    <option value="">Select position</option>
                    {positionOptions.map(o => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-gray-700">Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => {
                      setName(e.target.value);
                      setErrors(prev => ({ ...prev, name: false }));
                    }}
                    className={`mt-1 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8a1ccf] ${errors.name ? 'border-red-500' : 'border-gray-300'}`}
                  />
                </div>

                {/* Mobile Number */}
                <div>
                  <label className="block text-gray-700">Mobile Number</label>
                  <input
                    type="tel"
                    value={mobileNumber}
                    onChange={e => {
                      setMobileNumber(e.target.value);
                      setErrors(prev => ({ ...prev, mobileNumber: false }));
                    }}
                    onBlur={handleMobileBlur}
                    className={`mt-1 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8a1ccf] ${errors.mobileNumber ? 'border-red-500' : 'border-gray-300'}`}
                  />
                </div>

                {/* WhatsApp Number */}
                <div>
                  <label className="block text-gray-700">WhatsApp Number</label>
                  <input
                    type="tel"
                    value={whatsappNumber}
                    onChange={e => {
                      setWhatsappNumber(e.target.value);
                      setErrors(prev => ({ ...prev, whatsappNumber: false }));
                    }}
                    className={`mt-1 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8a1ccf] ${errors.whatsappNumber ? 'border-red-500' : 'border-gray-300'}`}
                  />
                </div>

                {/* Aadhar Number (Optional) */}
                <div>
                  <label className="block text-gray-700">Aadhar Number (Optional)</label>
                  <input
                    type="text"
                    value={aadharNumber}
                    onChange={e => setAadharNumber(e.target.value)}
                    className={`mt-1 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8a1ccf] border-gray-300`}
                  />
                </div>

                {/* Bank Account Number (MANDATORY) */}
                <div>
                  <label className="block text-gray-700">Bank Account Number</label>
                  <input
                    type="text"
                    value={bankAccountNumber}
                    onChange={e => {
                      setBankAccountNumber(e.target.value);
                      setErrors(prev => ({ ...prev, bankAccountNumber: false }));
                    }}
                    className={`mt-1 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8a1ccf] ${errors.bankAccountNumber ? 'border-red-500' : 'border-gray-300'}`}
                  />
                </div>

                {/* IFSC Code (MANDATORY) */}
                <div>
                  <label className="block text-gray-700">IFSC Code</label>
                  <input
                    type="text"
                    value={ifscCode}
                    onChange={e => {
                      setIfscCode(e.target.value);
                      setErrors(prev => ({ ...prev, ifscCode: false }));
                    }}
                    className={`mt-1 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8a1ccf] ${errors.ifscCode ? 'border-red-500' : 'border-gray-300'}`}
                  />
                </div>

                {/* Residing State */}
                <div>
                  <label className="block text-gray-700">Residing State</label>
                  <select
                    value={residingState}
                    onChange={e => {
                      setResidingState(e.target.value);
                      setErrors(prev => ({ ...prev, residingState: false }));
                    }}
                    className={`mt-1 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8a1ccf] ${errors.residingState ? 'border-red-500' : 'border-gray-300'}`}
                  >
                    <option value="">Select</option>
                    {statesOfIndia.map(s => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                {/* If Admissions Officer, show extra fields */}
                {position === 'officer' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Designation */}
                    <div>
                      <label className="block text-gray-700">Designation</label>
                      <select
                        value={designation}
                        onChange={e => {
                          setDesignation(e.target.value);
                          setErrors(prev => ({ ...prev, designation: false }));
                        }}
                        className={`mt-1 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8a1ccf] ${errors.designation ? 'border-red-500' : 'border-gray-300'}`}
                      >
                        <option value="">Select</option>
                        <option>Lecturer/Professor/Teaching Staff</option>
                        <option>Administrative/Admissions Staff</option>
                        <option>Non Educational Industry</option>
                      </select>
                    </div>
                    {/* Associated With */}
                    <div>
                      <label className="block text-gray-700">Associated With</label>
                      <select
                        value={associatedWith}
                        onChange={e => {
                          setAssociatedWith(e.target.value);
                          setErrors(prev => ({ ...prev, associatedWith: false }));
                        }}
                        className={`mt-1 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8a1ccf] ${errors.associatedWith ? 'border-red-500' : 'border-gray-300'}`}
                      >
                        <option value="">Select</option>
                        <option>PU</option>
                        <option>School</option>
                        <option>Non Educational</option>
                      </select>
                    </div>
                    {/* Teaching Subject */}
                    <div>
                      <label className="block text-gray-700">Teaching Subject</label>
                      <select
                        value={teachingSubject}
                        onChange={e => {
                          setTeachingSubject(e.target.value);
                          setErrors(prev => ({ ...prev, teachingSubject: false }));
                        }}
                        className={`mt-1 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8a1ccf] ${errors.teachingSubject ? 'border-red-500' : 'border-gray-300'}`}
                      >
                        <option value="">Select</option>
                        <option>Physics</option>
                        <option>Maths</option>
                        <option>Biology</option>
                        <option>Chemistry</option>
                        <option>Others</option>
                      </select>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Email */}
            <div>
              <label className="block text-gray-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => {
                  setEmail(e.target.value);
                  setErrors(prev => ({ ...prev, email: false }));
                }}
                className={`mt-1 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8a1ccf] ${errors.email ? 'border-red-500' : 'border-gray-300'}`}
                required
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-gray-700 mb-1">
                Password
              </label>
              <div className="relative w-full">
                <input
                  id="password"
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    setErrors(prev => ({ ...prev, password: false }));
                  }}
                  className={`w-full px-4 py-2 pr-12 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8a1ccf] ${errors.password ? 'border-red-500' : 'border-gray-300'}`}
                  required
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <button
                    type="button"
                    onClick={() => setShowPwd(p => !p)}
                    className="focus:outline-none"
                    aria-label={showPwd ? 'Hide password' : 'Show password'}
                  >
                    {showPwd
                      ? <VisibilityOff className="w-5 h-5 text-gray-500" />
                      : <Visibility className="w-5 h-5 text-gray-500" />
                    }
                  </button>
                </div>
              </div>
            </div>

            <p className="text-right text-sm -mt-2">
              {!isNew && (
                <Link to="/forgot-password" className="text-[#8a1ccf] hover:underline">
                  Forgot Password?
                </Link>
              )}
            </p>

            {/* Confirm Password (only for register) */}
            {isNew && (
              <div>
                <label htmlFor="confirm-password" className="block text-gray-700 mb-1">
                  Confirm Password
                </label>
                <div className="relative w-full">
                  <input
                    id="confirm-password"
                    type={showConfirmPwd ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => {
                      setConfirm(e.target.value);
                      setErrors(prev => ({ ...prev, confirm: false }));
                    }}
                    className={`w-full px-4 py-2 pr-12 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8a1ccf] ${errors.confirm ? 'border-red-500' : 'border-gray-300'}`}
                    required
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <button
                      type="button"
                      onClick={() => setShowConfirmPwd(p => !p)}
                      className="focus:outline-none"
                      aria-label={showConfirmPwd ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPwd
                        ? <VisibilityOff className="w-5 h-5 text-gray-500" />
                        : <Visibility className="w-5 h-5 text-gray-500" />
                      }
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            <button
              type="submit"
              className="w-full mt-4 bg-[#8a1ccf] text-white py-3 rounded-lg shadow-lg hover:bg-[#7a1bbf] transition-colors duration-300"
            >
              {isNew ? 'Register' : 'Login'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm">
            {isNew ? 'Already have an account? ' : 'New user? '}
            <button
              onClick={() => {
                resetForm();
                setIsNew(!isNew);
              }}
              className="text-[#8a1ccf] text-xl font-bold hover:underline"
            >
              {isNew ? 'Sign In' : 'Register'}
            </button>
          </p>
        </div>
        
        {/* Right half: Illustration */}
        <div className="hidden md:flex md:w-1/2 bg-gray-100 items-center justify-center">
          <img
            src={isNew ? "https://firebasestorage.googleapis.com/v0/b/yaswa-smd.firebasestorage.app/o/illustrations'%2Fregister2.gif?alt=media&token=849e1ecc-274d-4a33-81a1-4f566747f1c0" : "https://firebasestorage.googleapis.com/v0/b/yaswa-smd.firebasestorage.app/o/illustrations'%2Fregister3.gif?alt=media&token=379cc32b-2a0a-4639-b164-4d8b3293deb7"}
            alt={isNew ? 'Register Illustration' : 'Login Illustration'}
            className="w-full h-full object-cover"
          />
        </div>
      </div>

    </div>
  );
}
