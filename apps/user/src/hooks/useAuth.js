import { useState, useEffect } from 'react';
import { auth } from '../api';

function getInitialUser() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('login') === '1') {
    auth.clear();
    window.history.replaceState(null, '', window.location.pathname);
    return null;
  }
  return auth.user;
}

export function useAuth() {
  const [user, setUser] = useState(getInitialUser);

  useEffect(() => {
    const sync = () => setUser(auth.user);
    window.addEventListener('wba-auth-updated', sync);
    return () => window.removeEventListener('wba-auth-updated', sync);
  }, []);

  return { user, setUser };
}
