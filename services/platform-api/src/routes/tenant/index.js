import express from 'express';
import { registerAuthRoutes } from './auth.js';
import { registerProfileRoutes } from './profile.js';
import { registerWebsitesRoutes } from './websites.js';
import { registerConfigRoutes } from './config.js';
import { registerKeysRoutes } from './keys.js';
import { registerConversationsRoutes } from './conversations.js';
import { registerKnowledgeRoutes } from './knowledge.js';

export const tenantRouter = express.Router();

registerAuthRoutes(tenantRouter);
registerProfileRoutes(tenantRouter);
registerWebsitesRoutes(tenantRouter);
registerConfigRoutes(tenantRouter);
registerKeysRoutes(tenantRouter);
registerConversationsRoutes(tenantRouter);
registerKnowledgeRoutes(tenantRouter);
