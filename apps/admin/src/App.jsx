import { useState } from 'react';
import { Routes, Route, Outlet } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Login from './Login';
import { auth } from './api';

import AdminOverview from './pages/AdminOverview';
import Tenants from './pages/Tenants';
import CompaniesUsers from './pages/CompaniesUsers';
import Revenue from './pages/Revenue';
import SystemHealth from './pages/SystemHealth';
import AIModels from './pages/AIModels';
import ApiKeys from './pages/ApiKeys';
import CrawlJobs from './pages/CrawlJobs';
import ContentModeration from './pages/ContentModeration';
import AuditLog from './pages/AuditLog';
import Support from './pages/Support';
import Announcements from './pages/Announcements';
import PlatformSettings from './pages/PlatformSettings';

function Layout() {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-wrap">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(auth.user);

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<AdminOverview />} />
        <Route path="tenants" element={<Tenants />} />
        <Route path="users" element={<CompaniesUsers />} />
        <Route path="revenue" element={<Revenue />} />
        <Route path="system" element={<SystemHealth />} />
        <Route path="ai-models" element={<AIModels />} />
        <Route path="api-keys" element={<ApiKeys />} />
        <Route path="crawl-jobs" element={<CrawlJobs />} />
        <Route path="moderation" element={<ContentModeration />} />
        <Route path="audit-log" element={<AuditLog />} />
        <Route path="support" element={<Support />} />
        <Route path="announcements" element={<Announcements />} />
        <Route path="settings" element={<PlatformSettings />} />
      </Route>
    </Routes>
  );
}
