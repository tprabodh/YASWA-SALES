// src/Components/EmployeeDetailsModal.jsx
import React from 'react';
import Modal from 'react-modal';

Modal.setAppElement('#root');

export default function EmployeeDetailsModal({
  isOpen,
  onRequestClose,
  employee,
  employees,
}) {
  if (!employee) return null;

  // Map subordinate companyIds → names
  const subordinateNames = employee.subordinates?.map((subId) => {
    const sub = employees.find((e) => e.companyId === subId);
    return sub ? sub.name : subId;
  });

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      overlayClassName="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 outline-none"
    >
      <h2 className="text-2xl font-semibold text-[#8a1ccf] mb-4 text-center">
        Employee Details
      </h2>

      <div className="space-y-2 text-gray-800">
        <p><span className="font-medium">Name:</span> {employee.name}</p>
        <p><span className="font-medium">Email:</span> {employee.email}</p>
        <p>
          <span className="font-medium">Role:</span>{' '}
          {employee.role === 'manager'
            ? 'Manager'
            : employee.role === 'admin'
            ? 'Admin'
            : 'Employee'}
        </p>
        <p><span className="font-medium">Company ID:</span> {employee.companyId}</p>
        <p><span className="font-medium">Mobile:</span> {employee.mobileNumber}</p>
        <p><span className="font-medium">WhatsApp:</span> {employee.whatsappNumber}</p>
        <p><span className="font-medium">Aadhaar:</span> {employee.aadharNumber}</p>
        <p><span className="font-medium">Bank A/C:</span> {employee.bankAccountNumber}</p>
        <p><span className="font-medium">IFSC:</span> {employee.ifscCode}</p>
        <p><span className="font-medium">Designation:</span> {employee.designation}</p>
        <p><span className="font-medium">Associated With:</span> {employee.associatedWith}</p>
        <p><span className="font-medium">Teaching Subject:</span> {employee.teachingSubject}</p>
        <p><span className="font-medium">Residing State:</span> {employee.residingState}</p>
        <p>
          <span className="font-medium">Supervisor:</span>{' '}
          {employee.supervisorId || 'None'}
        </p>

        {subordinateNames?.length > 0 && (
          <div>
            <span className="font-medium">Subordinates:</span>
            <ul className="list-disc list-inside mt-1">
              {subordinateNames.map((name, i) => (
                <li key={i}>{name}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-6 text-center">
        <button
          className="px-4 py-2 bg-[#8a1ccf] text-white rounded-lg shadow hover:bg-[#7a1bbf] transition"
          onClick={onRequestClose}
        >
          Close
        </button>
      </div>
    </Modal>
  );
}
