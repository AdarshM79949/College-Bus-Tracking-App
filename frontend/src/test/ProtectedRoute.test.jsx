import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import ProtectedRoute from '../components/ProtectedRoute';

const mockUseAuth = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

function renderAdminOnly(path = '/admin-only') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div data-testid="login">Login</div>} />
        <Route path="/" element={<div data-testid="home">Home</div>} />
        <Route
          path="/admin-only"
          element={
            <ProtectedRoute roles={['admin']}>
              <div data-testid="secret">Admin only</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('shows loading while auth is loading', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: true,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });
    renderAdminOnly();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  test('redirects to login when not authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });
    renderAdminOnly();
    expect(screen.getByTestId('login')).toBeInTheDocument();
  });

  test('redirects to home when role is not allowed', () => {
    mockUseAuth.mockReturnValue({
      user: { name: 'S', email: 's@x.com', role: 'student' },
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });
    renderAdminOnly();
    expect(screen.getByTestId('home')).toBeInTheDocument();
  });

  test('renders children when role is allowed', () => {
    mockUseAuth.mockReturnValue({
      user: { name: 'A', email: 'a@x.com', role: 'admin' },
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });
    renderAdminOnly();
    expect(screen.getByTestId('secret')).toBeInTheDocument();
  });
});
