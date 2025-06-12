// src/Components/AssignBusinessHeadsModal.jsx
import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';

/**
 * Props:
 *  - isOpen: boolean
 *  - onRequestClose: () => void
 *  - salesHead: object  (the sales‐head user document)
 *  - businessHeads: array of user objects, each with { id, name, companyId, ... }
 *  - onAssign: fn( arrayOfBusinessHeadUIDs ) => void
 */
export default function AssignBusinessHeadsModal({
  isOpen,
  onRequestClose,
  salesHead,
  businessHeads,
  onAssign
}) {
  const [selectedIds, setSelectedIds] = useState([]);

  // Whenever the modal re‐opens for a different salesHead, reset selection
  useEffect(() => {
    setSelectedIds([]);
  }, [salesHead?.id]);

  const toggleId = uid => {
    setSelectedIds(prev =>
      prev.includes(uid)
        ? prev.filter(x => x !== uid)
        : [...prev, uid]
    );
  };

  const handleSubmit = () => {
    if (selectedIds.length === 0) {
      alert('Please select at least one Business Head.');
      return;
    }
    onAssign(selectedIds);
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      className="bg-white p-6 mx-auto mt-20 max-w-lg rounded shadow-lg outline-none"
      overlayClassName="fixed inset-0 bg-black bg-opacity-30 flex items-start justify-center"
    >
      <h3 className="text-lg font-semibold mb-4">
        Assign Business Heads to {salesHead?.name}
      </h3>
      <div className="max-h-64 overflow-y-auto border rounded p-2 mb-4">
        {businessHeads.length === 0 ? (
          <p className="text-gray-500">No Business Heads available.</p>
        ) : (
          businessHeads.map(bh => (
            <label key={bh.id} className="flex items-center space-x-2 mb-2">
              <input
                type="checkbox"
                checked={selectedIds.includes(bh.id)}
                onChange={() => toggleId(bh.id)}
                className="form-checkbox h-4 w-4 text-indigo-600"
              />
              <span className="text-gray-800">
                {bh.name} ({bh.companyId})
              </span>
            </label>
          ))
        )}
      </div>
      <div className="flex justify-end space-x-4">
        <button
          onClick={handleSubmit}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Assign
        </button>
        <button
          onClick={onRequestClose}
          className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
}
