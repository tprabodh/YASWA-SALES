import React from 'react';
import Modal from 'react-modal';

const EmployeeDetailsModal = ({ isOpen, onRequestClose, employee, employees }) => {
    if (!employee) return null;
  
    const subordinateNames = employee.subordinates?.map((subId) => {
      const subordinate = employees.find((emp) => emp.companyId === subId);
      return subordinate ? subordinate.name : subId;
    });
  
    return (
      <Modal isOpen={isOpen} onRequestClose={onRequestClose} contentLabel="Employee Details">
        <h2>Employee Details</h2>
        <p><strong>Name:</strong> {employee.name}</p>
        <p><strong>Email:</strong> {employee.email}</p>
        <p><strong>Role:</strong> {employee.role}</p>
        <p><strong>Supervisor:</strong> {employee.supervisorId || 'None'}</p>
        {subordinateNames && subordinateNames.length > 0 && (
          <div>
            <strong>Subordinates:</strong>
            <ul>
              {subordinateNames.map((name, index) => (
                <li key={index}>{name}</li>
              ))}
            </ul>
          </div>
        )}
        <button onClick={onRequestClose}>Close</button>
      </Modal>
    );
  };
  

export default EmployeeDetailsModal;
