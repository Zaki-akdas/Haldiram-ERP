---
name: Pre-Deploy
description: Deployment readiness verification
---

## Agents
1. **deploy-checker**: Verify build passes and bundle size
2. **env-validator**: Check all required environment variables
3. **dep-auditor**: Audit dependencies for vulnerabilities

## Steps
1. deploy-checker runs `npm run build` and checks for errors
2. env-validator compares .env.example with required vars
3. dep-auditor runs `npm audit` and reports findings
4. Generate deployment readiness report
