import { auth, baseUrl, coreApi } from './client.js';
import {
  crawlKnowledge,
  startCrawl,
  getCrawlStatus,
  cancelCrawl,
  pollCrawlToCompletion,
  uploadKnowledgeDocument,
} from './knowledge.js';

export { auth, baseUrl };

export const api = {
  baseUrl,
  ...coreApi,
  uploadKnowledgeDocument,
  crawlKnowledge,
  startCrawl,
  getCrawlStatus,
  cancelCrawl,
  pollCrawlToCompletion,
};
