// src/Components/AssignSubordinatesModal.jsx
import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';

// PROPS:
//   isOpen, onRequestClose, manager, employees (array of user objects), onAssign([...ids])
export default function AssignSubordinatesModal({
  isOpen,
  onRequestClose,
  manager,
  employees,      // <-- we will use this directly
  onAssign,
}) {
  const [selectedIds, setSelectedIds] = useState([]);

  // Whenever the modal opens, clear any selection
  useEffect(() => {
    if (isOpen) setSelectedIds([]);
  }, [isOpen]);

  // Helper to toggle one checkbox
  const toggleId = (uid) => {
    setSelectedIds(prev => 
      prev.includes(uid) ? prev.filter(x => x !== uid) : [...prev, uid]
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      className="bg-white p-6 mx-auto mt-20 max-w-lg rounded shadow-lg outline-none"
      overlayClassName="fixed inset-0 bg-black bg-opacity-30 flex items-start justify-center"
    >
      <h3 className="text-lg font-semibold mb-4">
        Assign Subordinates to {manager.name} ({manager.companyId})
      </h3>
      <div className="max-h-64 overflow-y-auto border p-2">
        {employees.length === 0 ? (
          <p className="text-gray-500">No users available to assign.</p>
        ) : (
          employees.map(user => (
            <div key={user.id} className="flex items-center mb-2">
              <input
                type="checkbox"
                checked={selectedIds.includes(user.id)}
                onChange={() => toggleId(user.id)}
                className="mr-2"
              />
              <span>
                {user.name} ({user.companyId}) &mdash; {user.role}
              </span>
            </div>
          ))
        )}
      </div>
      <div className="mt-4 flex justify-end space-x-2">
        <button
          onClick={onRequestClose}
          className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
        >
          Cancel
        </button>
        <button
          onClick={() => onAssign(selectedIds)}
          disabled={selectedIds.length === 0}
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
        >
          Assign ({selectedIds.length})
        </button>
      </div>
    </Modal>
  );
}
