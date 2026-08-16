import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import AppRoutes from './routes';
import { useAuth } from './hooks/useAuth';

export default function App() {
  const { user, setUser } = useAuth();

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <div className="app-layout">
      <Sidebar user={user} />
      <main className="main-content">
        <div className="page-wrap">
          <AppRoutes user={user} />
        </div>
      </main>
    </div>
  );
}
