/**
 * @fileoverview Security module for Requiem AI.
 *
 * Provides credential rotation and secret management capabilities.
 */

export {
  CredentialManager,
  getCredentialManager,
  setCredentialManager,
  rotateCredential,
  scheduleCredentialRotation,
} from './credentialRotation';

export type {
  Credential,
  CredentialType,
  CredentialSummary,
  CredentialManagerConfig,
  SecretStorage,
  RotationEvent,
  RotationSchedule,
  Duration,
} from './credentialRotation';
