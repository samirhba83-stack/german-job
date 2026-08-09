import appConfig from './app.config';
import releaseConfig from './release.config';
import databaseConfig from './database.config';
import jwtConfig from './jwt.config';
import executionActivationConfig from './execution-activation.config';
import billingConfig from './billing.config';
import emailInfrastructureConfig from './email-infrastructure.config';
import attachmentSecurityConfig from './attachment-security.config';
import connectedMailboxConfig from './connected-mailbox.config';
import inboxIntelligenceConfig from './inbox-intelligence.config';
import recruitmentOperationsConfig from './recruitment-operations.config';
import betaAccessConfig from './beta-access.config';
import productionSafetyConfig from './production-safety.config';

export const configurations = [
  appConfig,
  releaseConfig,
  databaseConfig,
  jwtConfig,
  executionActivationConfig,
  billingConfig,
  emailInfrastructureConfig,
  attachmentSecurityConfig,
  connectedMailboxConfig,
  inboxIntelligenceConfig,
  recruitmentOperationsConfig,
  betaAccessConfig,
  productionSafetyConfig,
];
