import { consumeAuthHandoff as consume } from '@wba/dashboard-ui/authHandoff';
import { auth } from '../api';

/** Read session passed from the marketing site (different port/origin). */
export function consumeAuthHandoff() {
  return consume(auth);
}
