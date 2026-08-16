import { Routes, Route, Navigate } from 'react-router-dom';
import Overview from './pages/Overview';
import KnowledgeBase from './pages/KnowledgeBase';
import Conversations from './pages/Conversations';
import Customize from './pages/Customize';
import ApiKeys from './pages/ApiKeys';
import Settings from './pages/Settings';
import Websites from './pages/Websites';
import Install from './pages/Install';
import { RequireWebsite } from './components/NoWebsitePrompt';

function WebsiteRoute({ user, children }) {
  return <RequireWebsite user={user}>{children}</RequireWebsite>;
}

export default function AppRoutes({ user }) {
  const start = user?.websiteId ? '/overview' : '/websites';

  return (
    <Routes>
      <Route path="/" element={<Navigate to={start} replace />} />
      <Route path="/overview" element={<Overview user={user} />} />
      <Route path="/setup/*" element={<Navigate to="/websites" replace />} />
      <Route path="/websites" element={<Websites user={user} />} />
      <Route path="/analytics" element={<Navigate to="/overview" replace />} />
      <Route path="/billing" element={<Navigate to="/settings" replace />} />
      <Route
        path="/knowledge-base"
        element={
          <WebsiteRoute user={user}>
            <KnowledgeBase user={user} />
          </WebsiteRoute>
        }
      />
      <Route path="/conversations" element={<Conversations user={user} />} />
      <Route
        path="/install"
        element={
          <WebsiteRoute user={user}>
            <Install user={user} />
          </WebsiteRoute>
        }
      />
      <Route
        path="/customize"
        element={
          <WebsiteRoute user={user}>
            <Customize user={user} />
          </WebsiteRoute>
        }
      />
      <Route
        path="/api-keys"
        element={
          <WebsiteRoute user={user}>
            <ApiKeys user={user} />
          </WebsiteRoute>
        }
      />
      <Route path="/settings" element={<Settings />} />
    </Routes>
  );
}
