export interface Artifact {
  cas_ref: string;
  media_type: string;
  size_bytes: number;
  redacted: boolean;
  created_at: string;
}

export interface ArtifactInput {
  media_type: string;
  content: string;
  redacted?: boolean;
}
