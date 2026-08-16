const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const USER_APP = import.meta.env.VITE_USER_APP_URL || 'http://localhost:5173';

export const urls = {
  api: API_BASE,
  userApp: USER_APP,
  login: `${USER_APP}?login=1`,
  signup: '/signup',
};
