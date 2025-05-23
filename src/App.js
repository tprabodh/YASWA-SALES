// src/App.js
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginPage          from './pages/LoginPage';
import ReportFormPage     from './pages/ReportFormPage';
import MyReportsPage      from './pages/MyReportsPage';
import ViewReportPage     from './pages/ViewReportPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import ProtectedLayout    from './Components/ProtectedLayout';
import AdminRoute from './Components/AdminRoute';
import EmployeeManagement from './pages/EmployeeManagement';
import './output.css';
import ForgotPassword from './pages/ForgotPassword';
import AdminEmployeeSummaryPage from './pages/AdminEmployeeSummaryPage';
import EmployeeSummaryDetailPage from './pages/EmployeeSummaryDetailPage';
import EmployeeDailyReportsPage from './pages/EmployeeDailyReportsPage';
import ManagerDashboardPage from './pages/ManagerDashboardPage';
import AssignManagersPage from './pages/AssignManagersPage';
import TelecallerDashboardPage from './pages/TelecallerDashboardPage';
import PaymentHistoryPage from './pages/PaymentHistoryPage';
import ManagerPaymentHistoryPage from './pages/ManagerPaymentHistoryPage';
import ManagerPaidReportsPage from './pages/ManagerPaidReportsPage';



function App() {
  return (
     <BrowserRouter basename="/YASWA-SALES">
      <Routes>
        {/* Public route */}
        <Route path="/" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* All these routes share the ProtectedLayout */}
          <Route element={<ProtectedLayout />}>

          <Route path="submit/:id?" element={<ReportFormPage />} />
          <Route path="reports"    element={<MyReportsPage />} />
          <Route path="view/:id"    element={<ViewReportPage />} />
          <Route path="admin"       element={<AdminDashboardPage />} />
          <Route path="admin/employee-summary" element={<AdminEmployeeSummaryPage />} />
          <Route path="admin/employee-summary/:uid" element={<EmployeeSummaryDetailPage />}/>
          <Route path="/manager" element={<ManagerDashboardPage />} />
          <Route path="/summary/:userId"element={<EmployeeDailyReportsPage hideApprove={true} />}/>
          
          <Route path="/assign-managers/:teleId" element={<AssignManagersPage />} />
            <Route path="/telecaller" element={<TelecallerDashboardPage />} />
            <Route path="payment-history" element={<PaymentHistoryPage />} />
            <Route path="manager-payment-history" element={<ManagerPaymentHistoryPage />} />
            <Route path="manager/paid-reports" element={<ManagerPaidReportsPage />} />
   

          <Route path="/admin/employees" element={ <AdminRoute> <EmployeeManagement /></AdminRoute> } />
          <Route path="/employee-management" element={<EmployeeManagement />} />
          <Route path="/admin" element={ <AdminRoute> <AdminDashboardPage /> </AdminRoute> } />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
