---
name: Release Prep
description: Full release preparation pipeline
---

## Agents
1. **auditor**: Run full-audit workflow
2. **fixer**: Apply fixes from audit findings
3. **deployer**: Run pre-deploy checks
4. **pr-creator**: Create pull request with changelog

## Steps
1. auditor runs the full-audit workflow
2. fixer applies automated fixes where possible
3. deployer verifies deployment readiness
4. pr-creator generates changelog and creates PR
