import { Shield, LogIn } from 'lucide-react';
import LoginForm from '@wba/dashboard-ui/LoginForm';
import { api, auth } from './api';

export default function Login({ onLogin }) {
  return (
    <LoginForm
      icon={Shield}
      submitIcon={LogIn}
      brandTitle="WBA Admin"
      brandSubtitle="لوحة تحكم المشرف"
      description="أدخل بيانات مشرف المنصة"
      defaultEmail="admin@acme-corp.com"
      login={api.login}
      onLogin={({ token, user }) => {
        auth.set({ token, user });
        onLogin(user);
      }}
    />
  );
}
