---
name: Full Audit
description: Comprehensive codebase audit with parallel auditors
---

## Agents
1. **type-auditor**: Check TypeScript types and strict mode compliance
2. **security-auditor**: Check auth, input validation, SQL injection risks
3. **performance-auditor**: Check N+1 queries, unnecessary re-renders
4. **accessibility-auditor**: Check a11y in all components
5. **error-handling-auditor**: Check error boundaries, try-catch coverage
6. **api-auditor**: Check REST conventions, status codes, response formats
7. **schema-auditor**: Check DB schema, indexes, constraints
8. **style-auditor**: Check CSS consistency, responsive design
9. **dependency-auditor**: Check for outdated or vulnerable packages
10. **test-auditor**: Check test coverage and quality
11. **doc-auditor**: Check documentation completeness
12. **fix-planner**: Aggregate findings and create prioritized fix plan

## Steps
1. Auditors 1-11 run in parallel, each producing a findings report
2. fix-planner aggregates all findings, deduplicates, and creates a prioritized fix plan
