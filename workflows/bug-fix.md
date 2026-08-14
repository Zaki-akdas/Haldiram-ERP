---
name: Bug Fix
description: Test-driven bug fix workflow
---

## Agents
1. **test-writer**: Write a failing test that reproduces the bug
2. **code-fixer**: Fix the code to make the test pass
3. **test-runner**: Run all tests to verify no regressions

## Steps
1. test-writer analyzes the bug report and writes a test
2. code-fixer reads the failing test and implements the fix
3. test-runner runs the full test suite
4. If tests fail, return to step 2
