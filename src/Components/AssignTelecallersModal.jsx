// src/Components/AssignTelecallersModal.jsx
import React, { useState } from 'react';
import Modal from 'react-modal';

Modal.setAppElement('#root');

export default function AssignTelecallersModal({
  isOpen,
  onRequestClose,
  businessHead,
  telecallers,
  onAssign,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTele, setSelectedTele] = useState([]);

  // Only show telecallers matching the search
  const filteredTele = telecallers.filter(
    (tc) =>
      tc.role === 'telecaller' &&
      tc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSelection = (id) => {
    setSelectedTele((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleAssign = () => {
    onAssign(selectedTele);
    setSelectedTele([]);
    setSearchQuery('');
    onRequestClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      overlayClassName="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      className="bg-white rounded-xl shadow-lg w-full max-w-md mx-4 p-6 outline-none"
    >
      <h2 className="text-xl font-semibold text-teal-600 mb-4">
        Assign Telecallers to {businessHead.name}
      </h2>

      <input
        type="text"
        placeholder="Search telecallers..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full mb-4 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600"
      />

      <ul className="max-h-60 overflow-y-auto space-y-2 mb-4">
        {filteredTele.map((tc) => (
          <li
            key={tc.id}
            className="flex justify-between items-center p-2 border rounded-md"
          >
            <div>
              <p className="font-medium">{tc.name}</p>
              <p className="text-xs text-gray-500">{tc.email}</p>
            </div>
            <button
              onClick={() => toggleSelection(tc.id)}
              className={`px-2 py-1 text-xs rounded ${
                selectedTele.includes(tc.id)
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-green-500 text-white hover:bg-green-600'
              } transition`}
            >
              {selectedTele.includes(tc.id) ? 'Remove' : 'Add'}
            </button>
          </li>
        ))}
      </ul>

      <div className="flex justify-end space-x-3">
        <button
          onClick={onRequestClose}
          className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition"
        >
          Cancel
        </button>
        <button
          onClick={handleAssign}
          disabled={!selectedTele.length}
          className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 transition disabled:opacity-50"
        >
          Assign
        </button>
      </div>
    </Modal>
  );
}
