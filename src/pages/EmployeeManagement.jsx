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

  // Disengage...
  const disengageEmployee = async emp => { /* as you have it */ };

  // Mark Paid & Export
  const handlePaid = async emp => { console.log("▶️ Marking paid for:", emp);};

  const openDetails = emp => { setSelectedEmployee(emp); setIsDetailsModalOpen(true); };
  const closeDetails = () => { setSelectedEmployee(null); setIsDetailsModalOpen(false); };

  const promoteToManager = async id => { /* with check for supervisorId */ };
  const demoteToEmployee = async id => { /* as is */ };

  const openAssign = mgr => { setSelectedManager(mgr); setIsAssignModalOpen(true); };
  const closeAssign = () => { setSelectedManager(null); setIsAssignModalOpen(false); };

  const assignSubs = async ids => { /* as is */ };

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
          onAssign={assignSubs}
        />
      )}
    </div>
  );
}
