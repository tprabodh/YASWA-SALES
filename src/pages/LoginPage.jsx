// src/pages/LoginPage.jsx

import React, { useState } from 'react';
import { useNavigate }                 from 'react-router-dom';
import { auth, db }                    from '../firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
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

export default function LoginPage() {
  const [position,           setPosition]           = useState("");
  const [isNew,              setIsNew]              = useState(false);
  const [name,               setName]               = useState('');
  const [email,              setEmail]              = useState('');
  const [password,           setPassword]           = useState('');
  const [confirm,            setConfirm]            = useState('');
  const [error,              setError]              = useState('');
  const [mobileNumber,       setMobileNumber]       = useState('');
  const [whatsappNumber,     setWhatsappNumber]     = useState('');
  const [aadharNumber,       setAadharNumber]       = useState('');
  const [bankAccountNumber,  setBankAccountNumber]  = useState('');
  const [ifscCode,           setIfscCode]           = useState('');
  const [residingState,      setResidingState]      = useState('');
  // Only for position==="officer":
  const [designation,        setDesignation]        = useState('');
  const [associatedWith,     setAssociatedWith]     = useState('');
  const [teachingSubject,    setTeachingSubject]    = useState('');

  // Track which inputs are invalid (for red‐border highlighting):
  const [errors, setErrors] = useState({});

  // Dropdown options
  const positionOptions = [
    { label: "Education Counseller",              value: "officer",       role: "employee",                       prefix: "EC" },
    { label: "Telecaller",                       value: "telecaller",    role: "telecaller",                     prefix: "TC" },
        { label: "Manager-Sales",                       value: "telecaller",    role: "telecaller",                     prefix: "TC" },
    { label: "Team Lead",                    value: "manager",       role: "manager",                        prefix: "TL" },
   /* { label: "Business Head",                    value: "businessHead",  role: "businessHead",                   prefix: "YH" },
        { label: "Sales Head",     value: "salesHead",     role: "salesHead",                      prefix: "SH" }, */

    { label: "Sales Associate",                  value: "associate",     role: "associate",                      prefix: "SA" },
    { label: "Business Development Consultant",          value: "bdConsultant",  role: "businessDevelopmentConsultant",  prefix: "BC" },
  ];

  const navigate = useNavigate();

  const statesOfIndia = [
    'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
    'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra',
    'Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim',
    'Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal'
  ];

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
    setPosition('');
    setErrors({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const newErrors = {};

    if (isNew) {
      // 1) Position is required
      if (!position) {
        newErrors.position = true;
      }

      // 2) Name/Email/Password/Confirm
      if (!name.trim())       newErrors.name = true;
      if (!email.trim())      newErrors.email = true;
      if (!password)          newErrors.password = true;
      if (!confirm)           newErrors.confirm = true;
      if (password && confirm && password !== confirm) {
        newErrors.password = true;
        newErrors.confirm = true;
      }

      // 3) Mobile & WhatsApp always required
      if (!mobileNumber.trim())     newErrors.mobileNumber = true;
      if (!whatsappNumber.trim())   newErrors.whatsappNumber = true;

      // 4) Bank Account & IFSC ALWAYS mandatory
      if (!bankAccountNumber.trim()) newErrors.bankAccountNumber = true;
      if (!ifscCode.trim())          newErrors.ifscCode         = true;

      // 5) If "officer", then those extra fields are also required:
      if (position === 'officer') {
        if (!aadharNumber.trim())       newErrors.aadharNumber   = true;
        if (!designation)               newErrors.designation    = true;
        if (!associatedWith)            newErrors.associatedWith = true;
        if (!teachingSubject)           newErrors.teachingSubject= true;
        if (!residingState)             newErrors.residingState  = true;
      }

      // 6) If BD Consultant/Associate/Employee, Aadhar is OPTIONAL—no extra check.

      // 7) If any errors: highlight and stop:
      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        setError("Please correct the highlighted fields.");
        return;
      }

      // 8) Show a custom confirm‐dialog BEFORE registering
      const declarationText = 
`Declaration:
I hereby declare that I am above 18 years of age and that I am legally competent to enter into this Collaboration Agreement. I voluntarily agree to collaborate with Yaswa Academy and to be bound by its terms and conditions, as may be amended from time to time.

Press “OK” to Agree & Register Now, or “Cancel” to abort.`;
      if (!window.confirm(declarationText)) {
        return; // user cancelled
      }
    }

    try {
      if (isNew) {
        // --- REGISTER NEW USER ---
        const userCred = await createUserWithEmailAndPassword(auth, email, password);

        // 1) Find role & prefix
        const { role: newRole, prefix } = positionOptions.find(o => o.value === position);

        // 2) Generate sequential companyId
        const newCompanyId = await generateNextCompanyId(prefix);

        // 3) If role ∈ {employee, associate, businessDevelopmentConsultant}, auto‐assign under a dummy manager
        let supervisorId = null;
        if (['employee','associate','businessDevelopmentConsultant'].includes(newRole)) {
          supervisorId = await assignUnderDummyManager(newCompanyId);
        }

        // 4) Build Firestore doc payload
        const userDoc = {
          name,
          email,
          role:               newRole,
          companyId:          newCompanyId,
          mobileNumber,
          whatsappNumber,
          aadharNumber:      aadharNumber || null,
          bankAccountNumber,
          ifscCode,
          residingState:     residingState || null,
          supervisorId,       // either null or dummy manager’s companyId
          subordinates:      [],
          isDummy:           false,
          createdAt:         serverTimestamp(),
          position
        };

        if (position === 'officer') {
          userDoc.designation     = designation;
          userDoc.associatedWith  = associatedWith;
          userDoc.teachingSubject = teachingSubject;
        }

        // 5) Write user document
        await setDoc(doc(db, 'users', userCred.user.uid), userDoc);

        // 6) Show toast with companyId
        toast.success(`Registration successful! Your Company ID: ${newCompanyId}`, {
          position: "top-center",
          autoClose: 4000
        });
      } else {
        // --- LOG IN EXISTING USER ---
        await signInWithEmailAndPassword(auth, email, password);
      }

      resetForm();
      navigate('/profile');
    } catch (err) {
      console.error(err);
      setError(err.message);
    }
  };

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
    <div className="min-h-screen bg-gradient-to-br from-[#8a1ccf]/80 to-[#8a1ccf]/60 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full flex overflow-hidden">
        <div className="w-full md:w-1/2 max-h-[90vh] overflow-y-auto p-8">
        <br />
        
         <ToastContainer />
        <h1 className="text-3xl font-bold text-center text-[#8a1ccf]">
          {isNew ? 'Sign Up' : 'Sign In'}
        </h1>

        {error && (
          <div className="bg-red-100 text-red-700 p-2 rounded text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
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
                  className={`mt-1 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8a1ccf]
                    ${errors.position ? 'border-red-500' : 'border-gray-300'}`}
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
                  className={`mt-1 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8a1ccf]
                    ${errors.name ? 'border-red-500' : 'border-gray-300'}`}
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
                  className={`mt-1 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8a1ccf]
                    ${errors.mobileNumber ? 'border-red-500' : 'border-gray-300'}`}
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
                  className={`mt-1 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8a1ccf]
                    ${errors.whatsappNumber ? 'border-red-500' : 'border-gray-300'}`}
                />
              </div>

              {/* Aadhar Number (Optional) */}
              <div>
                <label className="block text-gray-700">Aadhar Number (Optional)</label>
                <input
                  type="text"
                  value={aadharNumber}
                  onChange={e => setAadharNumber(e.target.value)}
                  className={`mt-1 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8a1ccf]
                    ${errors.name ? 'border-red-500' : 'border-gray-300'}`}
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
                  className={`mt-1 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8a1ccf]
                    ${errors.bankAccountNumber ? 'border-red-500' : 'border-gray-300'}`}
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
                  className={`mt-1 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8a1ccf]
                    ${errors.ifscCode ? 'border-red-500' : 'border-gray-300'}`}
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
                  className={`mt-1 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8a1ccf]
                    ${errors.residingState ? 'border-red-500' : 'border-gray-300'}`}
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
                      className={`mt-1 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8a1ccf]
                        ${errors.designation ? 'border-red-500' : 'border-gray-300'}`}
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
                      className={`mt-1 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8a1ccf]
                        ${errors.associatedWith ? 'border-red-500' : 'border-gray-300'}`}
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
                      className={`mt-1 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8a1ccf]
                        ${errors.teachingSubject ? 'border-red-500' : 'border-gray-300'}`}
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
              className={`mt-1 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8a1ccf]
                ${errors.email ? 'border-red-500' : 'border-gray-300'}`}
              required
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-gray-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => {
                setPassword(e.target.value);
                setErrors(prev => ({ ...prev, password: false }));
              }}
              className={`mt-1 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8a1ccf]
                ${errors.password ? 'border-red-500' : 'border-gray-300'}`}
              required
            />
          </div>

          <p className="text-right text-sm">
            {!isNew && (
              <Link to="/forgot-password" className="text-[#8a1ccf] hover:underline">
                Forgot Password?
              </Link>
            )}
          </p>

          {isNew && (
            <div>
              <label className="block text-gray-700">Confirm Password</label>
              <input
                type="password"
                value={confirm}
                onChange={e => {
                  setConfirm(e.target.value);
                  setErrors(prev => ({ ...prev, confirm: false }));
                }}
                className={`mt-1 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8a1ccf]
                  ${errors.confirm ? 'border-red-500' : 'border-gray-300'}`}
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
          {isNew ? 'Already have an account? ' : 'New user? '}
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
        {/* ToastContainer so that toast.success(...) can display */}
      <div className="hidden md:block md:w-1/2 bg-gray-100 flex items-center justify-center">
          {/* swap illustration based on mode */}
          <img
            src={isNew ?  "https://firebasestorage.googleapis.com/v0/b/yaswa-smd.firebasestorage.app/o/illustrations'%2Fregister2.gif?alt=media&token=849e1ecc-274d-4a33-81a1-4f566747f1c0" : "https://firebasestorage.googleapis.com/v0/b/yaswa-smd.firebasestorage.app/o/illustrations'%2Fregister3.gif?alt=media&token=379cc32b-2a0a-4639-b164-4d8b3293deb7"}
            alt={isNew ? 'Register Illustration' : 'Login Illustration'}
            className="max-w-full max-h-full"
          />
        </div>
      </div>
      <ToastContainer position="top-center" autoClose={4000} />
    </div>
  );
}
