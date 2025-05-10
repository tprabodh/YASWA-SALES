// src/App.js
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginPage          from './pages/LoginPage';
import ReportFormPage     from './pages/ReportFormPage';
import MyReportsPage      from './pages/MyReportsPage';
import ViewReportPage     from './pages/ViewReportPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import ProtectedLayout    from './Components/ProtectedLayout';
import AdminManageEmployees from './pages/AdminManageEmployees';
import AdminRoute from './Components/AdminRoute';
import EmployeeManagement from './pages/EmployeeManagement';
import './App.css';
import ManagerViewPage from './pages/ManagerViewPage';



function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public route */}
        <Route path="/" element={<LoginPage />} />

        {/* All these routes share the ProtectedLayout */}
        <Route element={<ProtectedLayout />}>
          <Route path="submit/:id?" element={<ReportFormPage />} />
          <Route path="reports"    element={<MyReportsPage />} />
          <Route path="view/:id"    element={<ViewReportPage />} />
          <Route path="admin"       element={<AdminDashboardPage />} />
          <Route path="/manager" element={<ManagerViewPage />} />
          <Route path="admin/manage-employees" element={<AdminManageEmployees />} />
          <Route path="/admin/employees" element={ <AdminRoute> <EmployeeManagement /></AdminRoute> } />
          <Route path="/employee-management" element={<EmployeeManagement />} />
          <Route path="/admin" element={ <AdminRoute> <AdminDashboardPage /> </AdminRoute> } />


        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
