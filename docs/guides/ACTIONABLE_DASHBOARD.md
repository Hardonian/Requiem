# Actionable Dashboard Guide

Use `/api/control-plane/insights` to power dashboard cards that always map to an action.

## Required fields per insight
- title/severity/priority/confidence
- evidence summary
- recommended action
- deep link target
- manual vs auto trigger availability
- explicit auto-trigger block reason when unavailable

## Empty-state policy
If data is insufficient, show the explicit insufficient-data insight rather than blank charts.
