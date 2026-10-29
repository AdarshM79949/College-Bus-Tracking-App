import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { AuthProvider } from '../context/AuthContext';
import Login from '../pages/Login';

beforeEach(() => {
  global.fetch = vi.fn();
  localStorage.clear();
});

function renderLogin() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Login />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('Login page', () => {
  test('renders login form by default', () => {
    const { container } = renderLogin();
    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
    expect(container.querySelector('input[type="email"]')).toBeInTheDocument();
    expect(container.querySelector('input[type="password"]')).toBeInTheDocument();
  });

  test('switches to register mode', () => {
    const { container } = renderLogin();
    fireEvent.click(screen.getByText(/no account\?/i));
    expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();
    // Register mode shows 3 inputs (name + email + password)
    expect(container.querySelectorAll('form input')).toHaveLength(3);
  });

  test('calls login API on submit', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ token: 'tok', user: { name: 'A', email: 'a@x.com', role: 'student' } }),
    });
    const { container } = renderLogin();
    fireEvent.change(container.querySelector('input[type="email"]'), { target: { value: 'a@x.com' } });
    fireEvent.change(container.querySelector('input[type="password"]'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
    const call = global.fetch.mock.calls[0];
    expect(call[0]).toContain('/api/auth/login');
  });
});
