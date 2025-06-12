// src/Components/AssignSubordinatesModal.jsx
import React, { useState } from 'react';
import Modal from 'react-modal';

Modal.setAppElement('#root');

export default function AssignSubordinatesModal({
  isOpen,
  onRequestClose,
  manager,
  employees,
  onAssign,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubordinates, setSelectedSubordinates] = useState([]);

  const filteredEmployees = employees.filter(
  emp =>
    emp.role === 'associate' &&  // instead of 'employee'
    emp.name.toLowerCase().includes(searchQuery.toLowerCase())
);

  const toggleSelection = (id) => {
    setSelectedSubordinates((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleAssign = () => {
    onAssign(selectedSubordinates);
    setSelectedSubordinates([]);
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
      <h2 className="text-xl font-semibold text-[#8a1ccf] mb-4">
        Assign Subordinates to {manager.name}
      </h2>

      <input
        type="text"
        placeholder="Search employees..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full mb-4 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#8a1ccf]"
      />

      <ul className="max-h-60 overflow-y-auto space-y-2 mb-4">
        {filteredEmployees.map((emp) => (
          <li
            key={emp.id}
            className="flex justify-between items-center p-2 border rounded-md"
          >
            <div>
              <p className="font-medium">{emp.name}</p>
              <p className="text-xs text-gray-500">{emp.email}</p>
            </div>
            <button
              onClick={() => toggleSelection(emp.id)}
              className={`px-2 py-1 text-xs rounded ${
                selectedSubordinates.includes(emp.id)
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-green-500 text-white hover:bg-green-600'
              } transition`}
            >
              {selectedSubordinates.includes(emp.id)
                ? 'Remove'
                : 'Add'}
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
          disabled={!selectedSubordinates.length}
          className="px-4 py-2 bg-[#8a1ccf] text-white rounded hover:bg-[#7a1bbf] transition disabled:opacity-50"
        >
          Assign
        </button>
      </div>
    </Modal>
  );
}
