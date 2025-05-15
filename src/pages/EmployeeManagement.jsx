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
    const employee = employees.find((emp) => emp.id === companyId);
    if (employee?.supervisorId) {
      alert('Please disengage this employee from their current manager before promoting.');
      return;
    }
  
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
      <br />
      <h2 className="text-2xl font-bold text-white-800 mb-4">Employee Management</h2>
      <br />
<SearchBar query={query} setQuery={setQuery} className="mb-6" />
<br />

      <div className="overflow-x-auto bg-white rounded-lg shadow">
  <table className="min-w-full divide-y divide-gray-200">
    <thead className="bg-gray-50">
      <tr>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company ID</th>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supervisor</th>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
      </tr>
    </thead>
    <tbody className="bg-white divide-y divide-gray-200">
      {filteredEmployees.map((emp) => (
        <tr key={emp.id}>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-black">{emp.name}</td>
<td className="px-6 py-4 whitespace-nowrap text-sm text-black">
  {emp.role.charAt(0).toUpperCase() + emp.role.slice(1)}
</td>
<td className="px-6 py-4 whitespace-nowrap text-sm text-black">{emp.companyId || 'N/A'}</td>
<td className="px-6 py-4 whitespace-nowrap text-sm text-black">
  {emp.supervisorId
    ? employees.find((e) => e.companyId === emp.supervisorId)?.name || 'N/A'
    : 'None'}
</td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 space-x-2">
            <button
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
              onClick={() => openDetailsModal(emp)}
            >
              View
            </button>
            {emp.role === 'employee' && (
              <button
                className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                onClick={() => promoteToManager(emp.id)}
              >
                Promote
              </button>
            )}
            {emp.role === 'manager' && (
              <>
                <button
                  className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                  onClick={() => demoteToEmployee(emp.id)}
                >
                  Demote
                </button>
                <button
                  className="px-3 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600"
                  onClick={() => openAssignModal(emp)}
                >
                  Assign
                </button>
              </>
            )}
            {emp.supervisorId && (
              <button
                className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                onClick={() => disengageEmployee(emp)}
              >
                Disengage
              </button>
            )}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>

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
