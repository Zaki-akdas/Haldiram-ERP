---
name: Pre-Commit
description: Pre-commit quality checks
---

## Agents
1. **code-auditor**: Review changed files for issues
2. **test-runner**: Run affected tests

## Steps
1. code-auditor reviews all staged changes
2. test-runner runs tests related to changed files
3. Report results with pass/fail status
