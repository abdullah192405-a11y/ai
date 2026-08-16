import { Sparkles, LogIn } from 'lucide-react';
import LoginForm from '@wba/dashboard-ui/LoginForm';
import { api, auth } from '../api';
import ThemeToggle from '../components/ThemeToggle';

export default function Login({ onLogin }) {
  return (
    <LoginForm
      icon={Sparkles}
      submitIcon={LogIn}
      brandTitle="WBA"
      brandSubtitle="لوحة التحكم"
      description="أدخل بياناتك للوصول إلى لوحة التحكم"
      login={api.login}
      onLogin={({ token, user }) => {
        auth.set({ token, user });
        onLogin(user);
      }}
      headerExtra={
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: 20,
            padding: '10px 12px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-2)',
            border: '1px solid var(--border-1)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <ThemeToggle compact />
        </div>
      }
    />
  );
}
