import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import StudentView from './pages/student/StudentView';
import DriverDashboard from './pages/driver/DriverDashboard';
import AdminLayout from './pages/admin/AdminLayout';
import Monitor from './pages/admin/Monitor';
import RoutesPage from './pages/admin/Routes';
import Buses from './pages/admin/Buses';
import Drivers from './pages/admin/Drivers';

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/student"
            element={
              <ProtectedRoute roles={['student', 'admin']}>
                <StudentView />
              </ProtectedRoute>
            }
          />
          <Route
            path="/driver"
            element={
              <ProtectedRoute roles={['driver', 'admin']}>
                <DriverDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={['admin']}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Monitor />} />
            <Route path="routes" element={<RoutesPage />} />
            <Route path="buses" element={<Buses />} />
            <Route path="drivers" element={<Drivers />} />
          </Route>
        </Routes>
      </div>
    </div>
  );
}
