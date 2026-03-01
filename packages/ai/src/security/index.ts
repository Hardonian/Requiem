/**
 * @fileoverview Security module for Requiem AI.
 *
 * Provides credential rotation, secret management, and artifact signing capabilities.
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

// Artifact Signing
export {
  getArtifactSigner,
  setArtifactSigner,
  signContent,
  verifyContent,
  signRunManifest,
  verifyRunManifest,
  isSigningEnabled,
  type IArtifactSigner,
  type ArtifactSignature,
  type ManifestSignature,
  type VerificationResult,
} from './signing';

// CAS Signing Integration
export {
  writeSignedCASObject,
  readVerifiedCASObject,
  verifyCASObjectSignature,
  hasCASObjectSignature,
  getCASObjectMetadata,
  getCASObjectPath,
  getCASSignaturePath,
} from './cas-signing';

// Manifest Signing
export {
  writeSignedRunManifest,
  readVerifiedRunManifest,
  verifyRunManifestSignature,
  hasRunManifestSignature,
  createRunManifest,
  verifyArtifactAtRead,
  verifyManifestAtServe,
  type RunManifest,
  type RunStep,
} from './manifest-signing';
