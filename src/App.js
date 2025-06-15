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
import ManagerPaymentBreakupPage from './pages/ManagerPaymentBreakupPage';
import ManagerUnpaidCommissionPage from './pages/ManagerUnpaidCommissionPage';
import BusinessHeadView from './pages/BusinessHeadView';
import AdminBusinessHeadSummaryPage from './pages/AdminBusinessHeadSummaryPage';
import ForecastPage from './pages/ForecastPage';
import ForecastInputPage from './pages/ForecastInputPage';
import ProfilePage from './pages/ProfilePage';
import AdminPaymentHistoryPage from './pages/AdminPaymentHistoryPage';
import UploadDesignPage from './pages/UploadDesignPage';
import DownloadsPage from './pages/DownloadsPage';
import BulletinInputPage from './pages/BulletinInputPage';
import BulletinPage from './pages/BulletinPage';
import MyBusinessHeadsPage from './pages/MyBusinessHeadsPage';
import BDCReportFormPage from './pages/BDCReportFormPage';
import UploadPDFTemplatePage from './pages/UploadPDFTemplatePage';
import ManagerSummaryPage from './pages/ManagerSummaryPage';



function App() {
 return (
    <BrowserRouter basename={process.env.PUBLIC_URL || '/'}>
      <Routes>
        {/* Public route */}
        <Route path="/" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* All these routes share the ProtectedLayout */}
          <Route element={<ProtectedLayout />}>

          <Route path="submit/:id?" element={<ReportFormPage />} />
          <Route path="/profile" element={<ProfilePage />} />
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
            <Route path="/admin/businesshead-summary" element={<AdminBusinessHeadSummaryPage />} />
            <Route path="/forecast" element={<ForecastPage />} />
                                   <Route path="/telecaller/manager-summary/:uid" element={<ManagerSummaryPage />}/>
            <Route path="/forecast-input" element={<ForecastInputPage />} />
            <Route path="/admin/upload-designs" element={<UploadDesignPage />} />
             <Route path="/downloads" element={<DownloadsPage />} />
               <Route path="/admin/bulletin-input" element={<BulletinInputPage />} />
               <Route path="/bdc-report" element={<BDCReportFormPage />} />
               <Route path="/bulletins/upload-pdf-template" element={<UploadPDFTemplatePage />} />
               <Route
  path="/my-business-heads"
  element={<MyBusinessHeadsPage />}
/>
        <Route path="/bulletins" element={<BulletinPage />} />
           

        {/* Associate payment‐history detail (shows the actual reports paid in that event) */}
       
                    <Route path="admin/payment-history" element={<AdminPaymentHistoryPage />} />
                  
            <Route path="manager-payment-breakup/:runId" element={<ManagerPaymentBreakupPage />}/>
            <Route path="/businesshead" element={<BusinessHeadView />} />
            <Route path="/manager-unpaid-commissions" element={<ManagerUnpaidCommissionPage />}/>
          <Route path="/admin/employees" element={ <AdminRoute> <EmployeeManagement /></AdminRoute> } />
          <Route path="/employee-management" element={<EmployeeManagement />} />
          <Route path="/admin" element={ <AdminRoute> <AdminDashboardPage /> </AdminRoute> } />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
