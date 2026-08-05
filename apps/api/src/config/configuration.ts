import appConfig from './app.config';
import databaseConfig from './database.config';
import jwtConfig from './jwt.config';
import executionActivationConfig from './execution-activation.config';
import billingConfig from './billing.config';
import emailInfrastructureConfig from './email-infrastructure.config';
import attachmentSecurityConfig from './attachment-security.config';
import connectedMailboxConfig from './connected-mailbox.config';
import inboxIntelligenceConfig from './inbox-intelligence.config';

export const configurations = [
  appConfig,
  databaseConfig,
  jwtConfig,
  executionActivationConfig,
  billingConfig,
  emailInfrastructureConfig,
  attachmentSecurityConfig,
  connectedMailboxConfig,
  inboxIntelligenceConfig,
];
