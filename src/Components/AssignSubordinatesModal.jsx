import React, { useState } from 'react';
import Modal from 'react-modal';

const AssignSubordinatesModal = ({
  isOpen,
  onRequestClose,
  manager,
  employees,
  onAssign,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubordinates, setSelectedSubordinates] = useState([]);

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.role === 'employee' &&
      emp.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSelection = (id) => {
    setSelectedSubordinates((prev) =>
      prev.includes(id)
        ? prev.filter((subId) => subId !== id)
        : [...prev, id]
    );
  };

  const handleAssign = () => {
    onAssign(selectedSubordinates);
    setSelectedSubordinates([]);
    setSearchQuery('');
    onRequestClose();
  };

  return (
    <Modal isOpen={isOpen} onRequestClose={onRequestClose}>
      <h2>Assign Subordinates to {manager.name}</h2>
      <input
        type="text"
        placeholder="Search employees..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      <ul>
        {filteredEmployees.map((emp) => (
          <li key={emp.id}>
            {emp.name} ({emp.email})
            <button onClick={() => toggleSelection(emp.id)}>
              {selectedSubordinates.includes(emp.id) ? 'Remove' : 'Add as Subordinate'}
            </button>
          </li>
        ))}
      </ul>
      <button onClick={handleAssign}>Assign Selected</button>
      <button onClick={onRequestClose}>Cancel</button>
    </Modal>
  );
};

export default AssignSubordinatesModal;
