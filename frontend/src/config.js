const rawBase = import.meta.env.VITE_API_BASE || 'http://localhost:4000';
export const API_BASE = rawBase.replace(/\/+$/, '');

