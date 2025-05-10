import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc, arrayUnion, deleteField, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase';
import SearchBar from '../Components/SearchBar';
import EmployeeDetailsModal from '../Components/EmployeeDetailsModal';
import AssignSubordinatesModal from '../Components/AssignSubordinatesModal';
import Modal from 'react-modal';

Modal.setAppElement('#root'); // Set the root element for accessibility

const EmployeeManagement = () => {
    
  const [employees, setEmployees] = useState([]);
  const [query, setQuery] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedManager, setSelectedManager] = useState(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  const disengageEmployee = async (employee) => {
    try {
      // Remove supervisorId from the employee's document
      const employeeRef = doc(db, 'users', employee.id);
      await updateDoc(employeeRef, {
        supervisorId: deleteField(),
      });
  
      // Find the manager's document by matching companyId
      const manager = employees.find((emp) => emp.companyId === employee.supervisorId);
      if (manager) {
        const managerRef = doc(db, 'users', manager.id);
        await updateDoc(managerRef, {
          subordinates: arrayRemove(employee.companyId),
        });
      }
  
      // Update local state to reflect changes
      setEmployees((prevEmployees) =>
        prevEmployees.map((emp) => {
          if (emp.id === employee.id) {
            const updatedEmp = { ...emp };
            delete updatedEmp.supervisorId;
            return updatedEmp;
          }
          if (manager && emp.id === manager.id) {
            return {
              ...emp,
              subordinates: emp.subordinates?.filter((id) => id !== employee.companyId) || [],
            };
          }
          return emp;
        })
      );
    } catch (error) {
      console.error('Error disengaging employee:', error);
    }
  };


  useEffect(() => {
    const fetchEmployees = async () => {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const employeeList = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setEmployees(employeeList);
    };
    fetchEmployees();
  }, []);

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.name.toLowerCase().includes(query.toLowerCase()) ||
      emp.id.toLowerCase().includes(query.toLowerCase())
  );

  const openDetailsModal = (employee) => {
    setSelectedEmployee(employee);
    setIsDetailsModalOpen(true);
  };

  const closeDetailsModal = () => {
    setSelectedEmployee(null);
    setIsDetailsModalOpen(false);
  };

  const promoteToManager = async (companyId) => {
    const employeeRef = doc(db, 'users', companyId);
    await updateDoc(employeeRef, { role: 'manager', supervisorId: null });
    setEmployees((prev) =>
      prev.map((emp) =>
        emp.id === companyId
          ? { ...emp, role: 'manager', supervisorId: null }
          : emp
      )
    );
  };
  

  const demoteToEmployee = async (companyId) => {
    const employeeRef = doc(db, 'users', companyId);
    await updateDoc(employeeRef, { role: 'employee' });
    setEmployees((prev) =>
      prev.map((emp) => (emp.id === companyId ? { ...emp, role: 'employee' } : emp))
    );
  };

  const openAssignModal = (manager) => {
    setSelectedManager(manager);
    setIsAssignModalOpen(true);
  };

  const closeAssignModal = () => {
    setSelectedManager(null);
    setIsAssignModalOpen(false);
  };
  

  const assignSubordinates = async (subordinateIds) => {
    if (!selectedManager || !selectedManager.companyId) {
      console.error('Selected manager is invalid or missing companyId.');
      return;
    }
  
    const updatedEmployees = [...employees];
    const managerCompanyId = selectedManager.companyId;
  
    // Update subordinates' supervisorId field
    for (const id of subordinateIds) {
      const employeeRef = doc(db, 'users', id);
      const employee = employees.find((emp) => emp.id === id);
      if (!employee) continue;
  
      await updateDoc(employeeRef, { supervisorId: managerCompanyId });
  
      const index = updatedEmployees.findIndex((emp) => emp.id === id);
      if (index !== -1) {
        updatedEmployees[index].supervisorId = managerCompanyId;
      }
    }
  
    // Update manager's subordinates field
    const managerRef = doc(db, 'users', selectedManager.id);
    const subordinateCompanyIds = subordinateIds
      .map((subId) => employees.find((e) => e.id === subId)?.companyId)
      .filter((id) => id); // Filter out undefined
  
    await updateDoc(managerRef, {
      subordinates: arrayUnion(...subordinateCompanyIds),
    });
  
    const updatedManagerIndex = updatedEmployees.findIndex(
      (emp) => emp.id === selectedManager.id
    );
    if (updatedManagerIndex !== -1) {
      const existingSubordinates =
        updatedEmployees[updatedManagerIndex].subordinates || [];
      updatedEmployees[updatedManagerIndex].subordinates = [
        ...new Set([...existingSubordinates, ...subordinateCompanyIds]),
      ];
    }
  
    setEmployees(updatedEmployees);
  };
  
  
  

  return (
    <div>
      <h2>Employee Management</h2>
      <SearchBar query={query} setQuery={setQuery} />
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Supervisor</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
        {filteredEmployees.map((emp) => (
  <tr key={emp.id}>
    <td>{emp.name}</td>
    <td>{emp.email}</td>
    <td>{emp.role}</td>
    <td>
      {emp.supervisorId
        ? employees.find((e) => e.companyId === emp.supervisorId)?.name || 'N/A'
        : 'None'}
    </td>
    <td>
      <button onClick={() => openDetailsModal(emp)}>View</button>
      {emp.role === 'employee' && (
        <button onClick={() => promoteToManager(emp.id)}>Promote to Manager</button>
      )}
      {emp.role === 'manager' && (
        <>
          <button onClick={() => demoteToEmployee(emp.id)}>Demote to Employee</button>
          <button onClick={() => openAssignModal(emp)}>Assign Subordinates</button>
        </>
      )}
      {emp.supervisorId && (
        <button onClick={() => disengageEmployee(emp)}>Disengage</button>
      )}
    </td>
  </tr>
))}

        </tbody>
      </table>
      <EmployeeDetailsModal
  isOpen={isDetailsModalOpen}
  onRequestClose={closeDetailsModal}
  employee={selectedEmployee}
  employees={employees} // Pass the full employee list
/>
      {selectedManager && (
        <AssignSubordinatesModal
          isOpen={isAssignModalOpen}
          onRequestClose={closeAssignModal}
          manager={selectedManager}
          employees={employees}
          onAssign={assignSubordinates}
        />
      )}
    </div>
  );
};

export default EmployeeManagement;
