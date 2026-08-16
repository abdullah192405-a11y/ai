import { createMarketingClient } from '@wba/dashboard-ui/createMarketingClient';
import { buildAuthHandoffUrl } from '@wba/dashboard-ui/authHandoff';
import { urls } from './lib/urls';

const client = createMarketingClient({ baseUrl: urls.api });

export function buildAuthHandoffUrlFromSession({ token, user }) {
  return buildAuthHandoffUrl({ userAppUrl: urls.userApp, token, user });
}

export async function signup({ name, email, password, plan }) {
  return client.signup({ name, email, password, plan });
}

export async function getPlans() {
  return client.getPlans();
}
