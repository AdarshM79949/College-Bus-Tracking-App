import { Link, NavLink, Outlet } from 'react-router-dom';

const tabs = [
  { to: '/admin', label: 'Monitor', end: true },
  { to: '/admin/routes', label: 'Routes' },
  { to: '/admin/buses', label: 'Buses' },
  { to: '/admin/drivers', label: 'Drivers' },
];

export default function AdminLayout() {
  return (
    <div className="p-4">
      <div className="flex gap-2 border-b border-slate-200 mb-4">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                isActive ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-600 hover:text-slate-900'
              }`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  );
}
