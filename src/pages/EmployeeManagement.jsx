// src/pages/EmployeeManagement.jsx
import React, { useEffect, useState } from 'react';
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  deleteField,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import SearchBar from '../Components/SearchBar';
import EmployeeDetailsModal from '../Components/EmployeeDetailsModal';
import AssignSubordinatesModal from '../Components/AssignSubordinatesModal';
import Modal from 'react-modal';

Modal.setAppElement('#root');

export default function EmployeeManagement() {
  const [employees, setEmployees] = useState([]);
  const [queryText, setQueryText] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedManager, setSelectedManager] = useState(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  // Fetch employees
   useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, 'users'));
      setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    })();
  }, []);

  const filtered = employees.filter(emp =>
    emp.name.toLowerCase().includes(queryText.toLowerCase())
  );

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

  // Mark Paid & Export
  // Full handlePaid implementation
    const handlePaid = async (emp) => {
    // 1) fetch all this employee’s reports by companyId
    const reportsRef = collection(db, 'reports');
    const q = query(
      reportsRef,
      where('companyId', '==', emp.companyId)
    );
    const snap = await getDocs(q);
    const allReports = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 2) warn if any Pending remain
    const pending = allReports.filter(r => r.status === 'Pending');
    if (pending.length) {
      alert(
        `Cannot mark paid – ${pending.length} report(s) are still Pending.\n` +
        `Approve or Reject them first.`
      );
      return;
    }

    // 3) update all Approved → paymentStatus:'paid'
    const approved = allReports.filter(r => r.status === 'Approved');
    for (let r of approved) {
      const rRef = doc(db, 'reports', r.id);
      await updateDoc(rRef, { paymentStatus: 'paid' });
    }

   // 4) build Excel data
const excelData = approved.map(r => ({
  'Employee Name': emp.name,
  'Company ID': r.companyId,
  'Student Name': r.studentName,
  'Grade': r.grade,
  'Created At': r.createdAt?.toDate().toLocaleString() || '',
  'Phone': r.studentPhone,
  'WhatsApp': r.whatsappNumber,
  'Email': r.studentEmail,
  'Course': r.course,
  'Status': r.status,
  'Payment Status': 'paid',
  'Commission (₹)': 2000,
}));


    // no approved reports? warn and exit
    if (excelData.length === 0) {
      alert('No Approved reports to mark as paid.');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Paid Reports');

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(
      new Blob([wbout], { type: "application/octet-stream" }),
      `${emp.name.replace(/\s+/g, '_')}_paid_reports.xlsx`
    );
  };


// **Mark Paid (Manager)**:
  const handleManagerPaidManager = async managerEmp => {
    // 1) fetch subordinates by supervisorId = managerEmp.companyId
    const usersQ = query(
      collection(db, 'users'),
      where('supervisorId', '==', managerEmp.companyId)
    );
    const usersSnap = await getDocs(usersQ);
    const subordinateIds = usersSnap.docs.map(d => d.id);

    if (!subordinateIds.length) {
      alert('This manager has no subordinates.');
      return;
    }

    // 2) fetch approved reports by those subordinates
    const reportsQ = query(
      collection(db, 'reports'),
      where('userId', 'in', subordinateIds),
      where('status', '==', 'Approved')
    );
    const repSnap = await getDocs(reportsQ);
    const approved = repSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (!approved.length) {
      alert('No Approved reports to mark paid for this manager.');
      return;
    }

    // 3) update each approved report
    await Promise.all(
      approved.map(r =>
        updateDoc(doc(db, 'reports', r.id), { managerCommission: 'paid' })
      )
    );

    // 4) build Excel
    const excelData = approved.map(r => ({
      'Employee Name':      managerEmp.name,
      'Employee Company ID': managerEmp.companyId,
      'Student Name':       r.studentName,
      'Grade':              r.grade,
      'Created At':         r.createdAt?.toDate().toLocaleString() || '',
      'Phone':              r.studentPhone,
      'WhatsApp':           r.whatsappNumber,
      'Email':              r.studentEmail,
      'Course':             r.course,
      'Status':             r.status,
      'Manager Commission': 'paid',
      'Commission (₹)':     500,
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Manager_Payouts');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

    saveAs(
      new Blob([wbout], { type: 'application/octet-stream' }),
      `${managerEmp.name.replace(/\s+/g, '_')}_manager_payouts.xlsx`
    );
  };


  const openDetails = emp => { setSelectedEmployee(emp); setIsDetailsModalOpen(true); };
  const closeDetails = () => { setSelectedEmployee(null); setIsDetailsModalOpen(false); };

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

  const openAssign = mgr => { setSelectedManager(mgr); setIsAssignModalOpen(true); };
  const closeAssign = () => { setSelectedManager(null); setIsAssignModalOpen(false); };

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
    <div className="min-h-screen bg-gray-50 p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">
        Employee Management
      </h2>

      <SearchBar
        query={queryText}
        setQuery={setQueryText}
        className="mb-6"
      />

      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              {['Name','Role','Company ID','Supervisor','Actions'].map(h => (
                <th
                  key={h}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filtered.map(emp => (
              <tr key={emp.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {emp.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {emp.role.charAt(0).toUpperCase() + emp.role.slice(1)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {emp.companyId || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {emp.supervisorId
                    ? employees.find(e => e.companyId === emp.supervisorId)?.name || 'N/A'
                    : 'None'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 space-x-2">
                  <button
                    type="button"
                    onClick={() => openDetails(emp)}
                    className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    View
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePaid(emp)}
                    className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    Mark Paid
                  </button>

                  {emp.role === 'employee' && (
                    <button
                      type="button"
                      onClick={() => promoteToManager(emp.id)}
                      className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                    >
                      Promote
                    </button>
                  )}

                  {emp.role === 'manager' && (
                    <>
                      <button
                        type="button"
                        onClick={() => demoteToEmployee(emp.id)}
                        className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                      >
                        Demote
                      </button>
                      <button
                        type="button"
                        onClick={() => openAssign(emp)}
                        className="px-3 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600"
                      >
                        Assign
                      </button>
                      <button
                        onClick={() => handleManagerPaidManager(emp)}
                        className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
                      >
                        Mark Paid (Mgr)
                      </button>
                    </>
                  )}

                  {emp.supervisorId && (
                    <button
                      type="button"
                      onClick={() => disengageEmployee(emp)}
                      className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
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
        onRequestClose={closeDetails}
        employee={selectedEmployee}
        employees={employees}
      />
      {selectedManager && (
        <AssignSubordinatesModal
          isOpen={isAssignModalOpen}
          onRequestClose={closeAssign}
          manager={selectedManager}
          employees={employees}
          onAssign={assignSubordinates}
        />
      )}
    </div>
  );
}
