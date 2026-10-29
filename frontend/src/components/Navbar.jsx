import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <nav className="bg-indigo-700 text-white px-4 py-3 flex items-center justify-between shadow">
      <Link to="/" className="font-bold text-lg">Campus Bus Tracker</Link>
      <div className="flex items-center gap-4 text-sm">
        {user ? (
          <>
            <span className="hidden sm:inline opacity-80">{user.email} ({user.role})</span>
            <button
              onClick={() => { logout(); navigate('/login'); }}
              className="bg-white/10 hover:bg-white/20 px-3 py-1 rounded"
            >
              Logout
            </button>
          </>
        ) : (
          <Link to="/login" className="bg-white/10 hover:bg-white/20 px-3 py-1 rounded">Login</Link>
        )}
      </div>
    </nav>
  );
}
