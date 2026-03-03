# Recording Runbook: Requiem Media

## 🎤 Professional Recording Standards

How to record Requiem consistently for demo assets.

## 1. Environment Baseline

- **OS**: macOS (Sonoma+) or Windows (WSL2/Linux).
- **Environment**: Clean/Sanitized (No random environment variables).
- **Tooling**: Ensure `pnpm reach` is pre-baked for fast execution.
- **Microphone**: Professional condenser microphone (e.g., Shure SM7B, Blue Yeti, Rode NT1-A).

## 2. CLI Capture Settings

- **Software**: OBS Studio or ScreenFlow (30/60fps).
- **Terminal**: `80x24` or `120x30` viewport.
- **Theme**: Dark mode (Horizon/Catppuccin).
- **Zoom**: Increase terminal font size for visibility (14pt-16pt).
- **Pointer**: Hide mouse pointer for purely CLI-focused shots.

## 3. Web UI Capture Settings

- **Software**: Chrome/Safari (Clean Profile).
- **Resolution**: 1920x1080 (100% Zoom).
- **Cleanliness**: Disable all browser extensions, bookmarks, and notifications.
- **Theme**: Consistency with CLI theme (Dark mode).

## 4. Voiceover (VO) Prep

1. Review `VOICEOVER_SCRIPTS.md`.
2. Perform a "Dry Run" without recording.
3. Record 3 takes of each segment.
4. Aim for "Calm, Deterministic" tone.

## 5. Post-Processing

- **Cuts**: No unnecessary dead air. Speed up installation/build processes if > 10s.
- **Audio**: Normalize LUFS to -14dB (Standard). Remove background noise/hum.
- **Artifacts**: Ensure the `Execution Fingerprint` is clearly visible and centered in the frame.
