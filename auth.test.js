const jwt = require('jsonwebtoken');
const config = require('../../src/config');
const { signToken, verifyToken, auth, requireRole } = require('../../src/middleware/auth');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('auth middleware', () => {
  const fakeUser = { _id: 'abc123', role: 'driver', email: 'd@x.com' };

  test('signToken + verifyToken round trip', () => {
    const token = signToken(fakeUser);
    const payload = verifyToken(token);
    expect(payload.sub).toBe('abc123');
    expect(payload.role).toBe('driver');
  });

  test('auth rejects missing header', () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();
    auth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('auth rejects invalid token', () => {
    const req = { headers: { authorization: 'Bearer garbage' } };
    const res = mockRes();
    const next = jest.fn();
    auth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('auth rejects expired token', () => {
    const expired = jwt.sign({ sub: 'x', role: 'student' }, config.jwtSecret, { expiresIn: -10 });
    const req = { headers: { authorization: `Bearer ${expired}` } };
    const res = mockRes();
    const next = jest.fn();
    auth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('auth attaches req.user for valid token', () => {
    const token = signToken(fakeUser);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();
    auth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user.role).toBe('driver');
  });

  test('requireRole allows matching role', () => {
    const req = { user: { role: 'admin' } };
    const res = mockRes();
    const next = jest.fn();
    requireRole('admin')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('requireRole rejects non-matching role', () => {
    const req = { user: { role: 'student' } };
    const res = mockRes();
    const next = jest.fn();
    requireRole('admin')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
