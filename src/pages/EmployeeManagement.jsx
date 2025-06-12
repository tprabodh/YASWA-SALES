// src/pages/EmployeeManagement.jsx

import React, { useEffect, useState } from 'react';
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  arrayUnion,
  deleteField,
  arrayRemove,
} from 'firebase/firestore';
import { db } from '../firebase';
import SearchBar from '../Components/SearchBar';
import EmployeeDetailsModal from '../Components/EmployeeDetailsModal';
import AssignSubordinatesModal from '../Components/AssignSubordinatesModal';
import AssignTelecallersModal from '../Components/AssignTelecallersModal';
import AssignBusinessHeadsModal from '../Components/AssignBusinessHeadsModal';
import Modal from 'react-modal';
import { useNavigate } from 'react-router-dom';

Modal.setAppElement('#root');

export default function EmployeeManagement() {
  const [promoteTarget, setPromoteTarget]             = useState(null);
  const [employees, setEmployees]                     = useState([]);
  const [queryText, setQueryText]                     = useState('');
  const [selectedEmployee, setSelectedEmployee]       = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen]   = useState(false);
  const [selectedManager, setSelectedManager]         = useState(null);
  const [isAssignModalOpen, setIsAssignModalOpen]     = useState(false);
  const [selectedBusinessHead, setSelectedBusinessHead]           = useState(null);
  const [isAssignTeleModalOpen, setIsAssignTeleModalOpen]         = useState(false);
  const [selectedAssociateManager, setSelectedAssociateManager]   = useState(null);
  const [isAssignAssociatesOpen, setIsAssignAssociatesOpen]       = useState(false);

  // NEW: for Sales Head
  const [selectedSalesHead, setSelectedSalesHead]                 = useState(null);
  const [isAssignBusinessHeadsOpen, setIsAssignBusinessHeadsOpen] = useState(false);

  const navigate = useNavigate();

  // ─── Fetch all users once on mount ─────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, 'users'));
      setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    })();
  }, []);

  // ─── Filter employees by name or companyId ─────────────────────────────────
  const filtered = employees.filter(emp =>
    emp.name.toLowerCase().includes(queryText.toLowerCase()) ||
    (emp.companyId || '').toLowerCase().includes(queryText.toLowerCase())
  );

  // ─── Disengage a subordinate from their supervisor ─────────────────────────
  const disengageEmployee = async (employee) => {
    try {
      // 1) Clear this user’s supervisorId
      const empRef = doc(db, 'users', employee.id);
      await updateDoc(empRef, { supervisorId: deleteField() });

      // 2) Find the old manager by matching companyId
      const oldManager = employees.find(e => e.companyId === employee.supervisorId);
      if (oldManager) {
        const mgrRef = doc(db, 'users', oldManager.id);
        await updateDoc(mgrRef, {
          subordinates: arrayRemove(employee.companyId)
        });
      }

      // 3) Update local state
      setEmployees(prev =>
        prev.map(e => {
          if (e.id === employee.id) {
            const updatedEmp = { ...e };
            delete updatedEmp.supervisorId;
            return updatedEmp;
          }
          if (oldManager && e.id === oldManager.id) {
            return {
              ...e,
              subordinates: (e.subordinates || []).filter(cid => cid !== employee.companyId)
            };
          }
          return e;
        })
      );
    } catch (err) {
      console.error('Error disengaging employee:', err);
    }
  };

  // ─── Open / close handlers for various modals ───────────────────────────────
  const openDetails = emp => {
    setSelectedEmployee(emp);
    setIsDetailsModalOpen(true);
  };
  const closeDetails = () => {
    setSelectedEmployee(null);
    setIsDetailsModalOpen(false);
  };

  const openAssignMgr = mgr => {
    setSelectedManager(mgr);
    setIsAssignModalOpen(true);
  };
  const closeAssignMgr = () => {
    setSelectedManager(null);
    setIsAssignModalOpen(false);
  };

  const openAssignTele = bh => {
    setSelectedBusinessHead(bh);
    setIsAssignTeleModalOpen(true);
  };
  const closeAssignTele = () => {
    setSelectedBusinessHead(null);
    setIsAssignTeleModalOpen(false);
  };

  const openAssignAssoc = am => {
    setSelectedAssociateManager(am);
    setIsAssignAssociatesOpen(true);
  };
  const closeAssignAssoc = () => {
    setSelectedAssociateManager(null);
    setIsAssignAssociatesOpen(false);
  };

  // ─── NEW: Open / close for AssignBusinessHeadsModal ────────────────────────
  const openAssignBusinessHeads = sh => {
    setSelectedSalesHead(sh);
    setIsAssignBusinessHeadsOpen(true);
  };
  const closeAssignBusinessHeads = () => {
    setSelectedSalesHead(null);
    setIsAssignBusinessHeadsOpen(false);
  };

  // ─── Assign subordinates to a manager ───────────────────────────────────────
  const assignSubordinates = async subordinateIds => {
    if (!selectedManager?.companyId) return;
    const updatedEmployees = [...employees];
    const mgrCid = selectedManager.companyId;

    // 1) Update each subordinate’s supervisorId
    for (const id of subordinateIds) {
      const eRef = doc(db, 'users', id);
      const emp = employees.find(e => e.id === id);
      if (!emp) continue;
      await updateDoc(eRef, { supervisorId: mgrCid });
      const idx = updatedEmployees.findIndex(e => e.id === id);
      if (idx !== -1) {
        updatedEmployees[idx].supervisorId = mgrCid;
      }
    }

    // 2) Update manager’s subordinates array
    const mgrRef = doc(db, 'users', selectedManager.id);
    const subCids = subordinateIds
      .map(subId => employees.find(e => e.id === subId)?.companyId)
      .filter(Boolean);

    await updateDoc(mgrRef, {
      subordinates: arrayUnion(...subCids)
    });

    const mgrIdx = updatedEmployees.findIndex(e => e.id === selectedManager.id);
    if (mgrIdx !== -1) {
      const existing = updatedEmployees[mgrIdx].subordinates || [];
      updatedEmployees[mgrIdx].subordinates = Array.from(new Set([...existing, ...subCids]));
    }

    setEmployees(updatedEmployees);
    closeAssignMgr();
  };

  // ─── Assign telecallers to a business head ─────────────────────────────────
  const assignTelecallers = async teleIds => {
    if (!selectedBusinessHead) return;
    const bhRef = doc(db, 'users', selectedBusinessHead.id);
    const teleCids = employees
      .filter(e => teleIds.includes(e.id))
      .map(e => e.companyId)
      .filter(Boolean);

    await updateDoc(bhRef, {
      telecallers: arrayUnion(...teleCids)
    });

    setEmployees(prev =>
      prev.map(e =>
        e.id === selectedBusinessHead.id
          ? {
              ...e,
              telecallers: Array.from(new Set([...(e.telecallers || []), ...teleCids]))
            }
          : e
      )
    );
    closeAssignTele();
  };

  // ─── Assign associates to an associateManager ───────────────────────────────
  const assignAssociates = async associateIds => {
    if (!selectedAssociateManager) return;
    const amRef = doc(db, 'users', selectedAssociateManager.id);
    const assocCids = associateIds
      .map(id => employees.find(e => e.id === id)?.companyId)
      .filter(Boolean);

    await updateDoc(amRef, {
      associates: arrayUnion(...assocCids)
    });

    // Set each associate’s associateManager field
    await Promise.all(
      associateIds.map(id => {
        const eRef = doc(db, 'users', id);
        return updateDoc(eRef, { associateManager: selectedAssociateManager.companyId });
      })
    );

    setEmployees(prev =>
      prev.map(e => {
        if (e.id === selectedAssociateManager.id) {
          const existing = e.associates || [];
          return {
            ...e,
            associates: Array.from(new Set([...existing, ...assocCids]))
          };
        }
        if (associateIds.includes(e.id)) {
          return { ...e, associateManager: selectedAssociateManager.companyId };
        }
        return e;
      })
    );
    closeAssignAssoc();
  };

  // ─── Assign business heads to a sales head ────────────────────────────────
  const assignBusinessHeads = async bhIds => {
    if (!selectedSalesHead) return;
    const shRef = doc(db, 'users', selectedSalesHead.id);
    const bhCids = bhIds
      .map(id => employees.find(e => e.id === id)?.companyId)
      .filter(Boolean);

    await updateDoc(shRef, {
      myBusinessHeads: arrayUnion(...bhCids)
    });

    // Optionally set each BH’s salesHead field
    await Promise.all(
      bhIds.map(id => {
        const ref = doc(db, 'users', id);
        return updateDoc(ref, { salesHead: selectedSalesHead.companyId });
      })
    );

    setEmployees(prev =>
      prev.map(e => {
        if (e.id === selectedSalesHead.id) {
          const existing = e.myBusinessHeads || [];
          return {
            ...e,
            myBusinessHeads: Array.from(new Set([...existing, ...bhCids]))
          };
        }
        if (bhIds.includes(e.id)) {
          return { ...e, salesHead: selectedSalesHead.companyId };
        }
        return e;
      })
    );
    closeAssignBusinessHeads();
  };

  // ─── Demote a manager back to “employee” ───────────────────────────────────
  const demoteToEmployee = async uid => {
    const ref = doc(db, 'users', uid);
    await updateDoc(ref, { role: 'employee' });
    setEmployees(prev =>
      prev.map(e => (e.id === uid ? { ...e, role: 'employee' } : e))
    );
  };

  // ─── Helper: change companyId prefix for promotions ────────────────────────
  function withNewPrefix(oldCid, newPrefix) {
    // oldCid format: “YSA-XX-####”
    const parts = oldCid.split('-');
    const suffix = parts[2] || '0000';
    return `YSA-${newPrefix}-${suffix}`;
  }

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <br /><br />
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
              {['Name','Role','Consultant ID','Supervisor','Actions'].map(h => (
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
                  {/* View Details */}
                  <button
                    type="button"
                    onClick={() => openDetails(emp)}
                    className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    View
                  </button>

                  {/* DISENGAGE */}
                  {['employee','associate','businessDevelopmentConsultant'].includes(emp.role) && emp.supervisorId && (
                    <button
                      onClick={() => disengageEmployee(emp)}
                      className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                    >
                      Disengage
                    </button>
                  )}

                  {/* If Telecaller, show “Assign Managers” */}
                  {emp.role === 'telecaller' && (
                    <button
                      className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                      onClick={() => navigate(`/assign-managers/${emp.id}`)}
                    >
                      Assign Team Leads
                    </button>
                  )}

                  {/* PROMOTE buttons for employee / associate / bdc */}
                  {['employee','associate','businessDevelopmentConsultant'].includes(emp.role) && (
                    <button
                      type="button"
                      onClick={() => setPromoteTarget(emp)}
                      className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                    >
                      Promote
                    </button>
                  )}

                  {/* If Telecaller, allow Demote */}
                  {emp.role === 'telecaller' && (
                    <button
                      type="button"
                      onClick={async () => {
                        const ref = doc(db, 'users', emp.id);
                        await updateDoc(ref, { role: 'employee' });
                        setEmployees(prev =>
                          prev.map(e =>
                            e.id === emp.id ? { ...e, role: 'employee' } : e
                          )
                        );
                      }}
                      className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                    >
                      Demote
                    </button>
                  )}

                  {/* If Manager, allow Demote + Assign Subordinates */}
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
                        onClick={() => openAssignMgr(emp)}
                        className="px-3 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600"
                      >
                        Assign
                      </button>
                    </>
                  )}

                  {/* If Business Head, allow “Assign Telecallers” */}
                  {emp.role === 'businessHead' && (
                    <button
                      onClick={() => openAssignTele(emp)}
                      className="px-3 py-1 bg-teal-500 text-white rounded hover:bg-teal-600"
                    >
                      Assign Telecallers
                    </button>
                  )}

                 

                  {/* If Sales Head, allow Assign Business Heads */}
                  {emp.role === 'salesHead' && (
                    <button
                      type="button"
                      onClick={() => openAssignBusinessHeads(emp)}
                      className="px-3 py-1 bg-pink-600 text-white rounded hover:bg-pink-700"
                    >
                      Assign Senior Managers
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

      {/* ─── Promote Modal ────────────────────────────────────────────────── */}
      <Modal
        isOpen={!!promoteTarget}
        onRequestClose={() => setPromoteTarget(null)}
        className="bg-white p-6 mx-auto mt-20 max-w-sm rounded shadow-lg outline-none"
        overlayClassName="fixed inset-0 bg-black bg-opacity-30 flex items-start justify-center"
      >
        <h3 className="text-lg font-semibold mb-4">
          Promote {promoteTarget?.name}
        </h3>
        <div className="flex flex-col space-y-3">
          <button
            onClick={async () => {
              // Promote → Manager (prefix TL)
              const oldCid = promoteTarget.companyId;
              const newCid = withNewPrefix(oldCid, 'TL');
              const ref = doc(db, 'users', promoteTarget.id);

              // 1) Update Firestore:
              await updateDoc(ref, {
                role: 'manager',
                companyId: newCid,
                supervisorId: null
              });

              // 2) If they had a supervisor, update that manager’s subordinates:
              if (promoteTarget.supervisorId) {
                const oldMgr = employees.find(e => e.companyId === promoteTarget.supervisorId);
                if (oldMgr) {
                  const oldMgrRef = doc(db, 'users', oldMgr.id);
                  await updateDoc(oldMgrRef, {
                    subordinates: arrayRemove(oldCid),
                  });
                  await updateDoc(oldMgrRef, {
                    subordinates: arrayUnion(newCid),
                  });
                }
              }

              // 3) Update local state for this user & the old manager:
              setEmployees(prev =>
                prev.map(e => {
                  if (e.id === promoteTarget.id) {
                    const copy = { ...e };
                    copy.role = 'manager';
                    copy.companyId = newCid;
                    delete copy.supervisorId;
                    return copy;
                  }
                  if (e.companyId === promoteTarget.supervisorId) {
                    return {
                      ...e,
                      subordinates: e.subordinates
                        .filter(cid => cid !== oldCid)
                        .concat([newCid])
                    };
                  }
                  return e;
                })
              );

              setPromoteTarget(null);
            }}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Promote to Team Lead
          </button>

          <button
            onClick={async () => {
              // Promote → Telecaller (prefix TC)
              const oldCid = promoteTarget.companyId;
              const newCid = withNewPrefix(oldCid, 'TC');
              const ref = doc(db, 'users', promoteTarget.id);
              await updateDoc(ref, { role: 'telecaller', companyId: newCid });

              // Update old manager’s subordinates if needed:
              if (promoteTarget.supervisorId) {
                const oldMgr = employees.find(e => e.companyId === promoteTarget.supervisorId);
                if (oldMgr) {
                  const oldMgrRef = doc(db, 'users', oldMgr.id);
                  await updateDoc(oldMgrRef, {
                    subordinates: arrayRemove(oldCid),
                  });
                  await updateDoc(oldMgrRef, {
                    subordinates: arrayUnion(newCid),
                  });
                }
              }

              setEmployees(prev =>
                prev.map(e => {
                  if (e.id === promoteTarget.id) {
                    return { ...e, role: 'telecaller', companyId: newCid };
                  }
                  if (e.companyId === promoteTarget.supervisorId) {
                    return {
                      ...e,
                      subordinates: e.subordinates
                        .filter(cid => cid !== oldCid)
                        .concat([newCid])
                    };
                  }
                  return e;
                })
              );
              setPromoteTarget(null);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Promote to Telecaller/Manger-Sales
          </button>

          <button
            onClick={async () => {
              // Promote → Business Head (prefix SM)
              const oldCid = promoteTarget.companyId;
              const newCid = withNewPrefix(oldCid, 'SM');
              const ref = doc(db, 'users', promoteTarget.id);
              await updateDoc(ref, { role: 'businessHead', companyId: newCid });

              if (promoteTarget.supervisorId) {
                const oldMgr = employees.find(e => e.companyId === promoteTarget.supervisorId);
                if (oldMgr) {
                  const oldMgrRef = doc(db, 'users', oldMgr.id);
                  await updateDoc(oldMgrRef, {
                    subordinates: arrayRemove(oldCid),
                  });
                  await updateDoc(oldMgrRef, {
                    subordinates: arrayUnion(newCid),
                  });
                }
              }

              setEmployees(prev =>
                prev.map(e => {
                  if (e.id === promoteTarget.id) {
                    return { ...e, role: 'businessHead', companyId: newCid };
                  }
                  if (e.companyId === promoteTarget.supervisorId) {
                    return {
                      ...e,
                      subordinates: e.subordinates
                        .filter(cid => cid !== oldCid)
                        .concat([newCid])
                    };
                  }
                  return e;
                })
              );
              setPromoteTarget(null);
            }}
            className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
          >
            Promote to Senior Manager
          </button>

          <button
            onClick={async () => {
              // Promote → Sales Head (prefix SH)
              const oldCid = promoteTarget.companyId;
              const newCid = withNewPrefix(oldCid, 'SH');
              const ref = doc(db, 'users', promoteTarget.id);
              await updateDoc(ref, { role: 'salesHead', companyId: newCid });

              if (promoteTarget.supervisorId) {
                const oldMgr = employees.find(e => e.companyId === promoteTarget.supervisorId);
                if (oldMgr) {
                  const oldMgrRef = doc(db, 'users', oldMgr.id);
                  await updateDoc(oldMgrRef, {
                    subordinates: arrayRemove(oldCid),
                  });
                  await updateDoc(oldMgrRef, {
                    subordinates: arrayUnion(newCid),
                  });
                }
              }

              setEmployees(prev =>
                prev.map(e => {
                  if (e.id === promoteTarget.id) {
                    return { ...e, role: 'salesHead', companyId: newCid };
                  }
                  if (e.companyId === promoteTarget.supervisorId) {
                    return {
                      ...e,
                      subordinates: e.subordinates
                        .filter(cid => cid !== oldCid)
                        .concat([newCid])
                    };
                  }
                  return e;
                })
              );
              setPromoteTarget(null);
            }}
            className="px-4 py-2 bg-pink-600 text-white rounded hover:bg-pink-700"
          >
            Promote to Sales Head
          </button>

          <button
            onClick={() => setPromoteTarget(null)}
            className="mt-4 text-gray-600 hover:underline self-end"
          >
            Cancel
          </button>
        </div>
      </Modal>

      {/* ─── AssignSubordinatesModal ───────────────────────────────────────────── */}
      {selectedManager && (
        <AssignSubordinatesModal
          isOpen={isAssignModalOpen}
          onRequestClose={closeAssignMgr}
          manager={selectedManager}
          employees={employees}
          onAssign={assignSubordinates}
        />
      )}

      {/* ─── AssignTelecallersModal ───────────────────────────────────────────── */}
      {selectedBusinessHead && (
        <AssignTelecallersModal
          isOpen={isAssignTeleModalOpen}
          onRequestClose={closeAssignTele}
          businessHead={selectedBusinessHead}
          telecallers={employees.filter(e => e.role === 'telecaller')}
          onAssign={assignTelecallers}
        />
      )}

      {/* ─── AssignAssociatesModal ───────────────────────────────────────────── */}
      {selectedAssociateManager && (
        <AssignSubordinatesModal
          isOpen={isAssignAssociatesOpen}
          onRequestClose={closeAssignAssoc}
          manager={selectedAssociateManager}
          employees={employees.filter(e =>
            ['associate'].includes(e.role)
          )}
          onAssign={assignAssociates}
        />
      )}

      {/* ─── NEW: AssignBusinessHeadsModal ────────────────────────────────────── */}
      {selectedSalesHead && (
        <AssignBusinessHeadsModal
          isOpen={isAssignBusinessHeadsOpen}
          onRequestClose={closeAssignBusinessHeads}
          salesHead={selectedSalesHead}
          businessHeads={employees.filter(e => e.role === 'businessHead')}
          onAssign={assignBusinessHeads}
        />
      )}
    </div>
  );
}
