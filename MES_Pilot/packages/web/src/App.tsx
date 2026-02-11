import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './auth/AuthContext';
import ProtectedRoute from './auth/ProtectedRoute';
import LoginPage from './auth/LoginPage';
import AppLayout from './layout/AppLayout';
import Dashboard from './pages/Dashboard';
import JobCenter from './pages/JobCenter';
import WorkOrderDetail from './pages/WorkOrderDetail';
import QcChecks from './pages/QcChecks';
import Deviations from './pages/Deviations';
import RecipeList from './pages/RecipeList';
import RecipeDetail from './pages/RecipeDetail';
import ProductList from './pages/ProductList';
import MaterialList from './pages/MaterialList';
import SiteList from './pages/SiteList';
import AreaList from './pages/AreaList';
import WorkCenterList from './pages/WorkCenterList';
import ReasonCodeList from './pages/ReasonCodeList';
import QcTemplateList from './pages/QcTemplateList';
import UserList from './pages/UserList';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/job-center" element={<JobCenter />} />
                <Route path="/work-orders/:id" element={<WorkOrderDetail />} />
                <Route path="/qc-checks" element={<QcChecks />} />
                <Route path="/deviations" element={<Deviations />} />
                <Route path="/recipes" element={<RecipeList />} />
                <Route path="/recipes/:id" element={<RecipeDetail />} />
                <Route path="/products" element={<ProductList />} />
                <Route path="/materials" element={<MaterialList />} />
                <Route path="/sites" element={<SiteList />} />
                <Route path="/areas" element={<AreaList />} />
                <Route path="/work-centers" element={<WorkCenterList />} />
                <Route path="/reason-codes" element={<ReasonCodeList />} />
                <Route path="/qc-templates" element={<QcTemplateList />} />
                <Route path="/users" element={<UserList />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
