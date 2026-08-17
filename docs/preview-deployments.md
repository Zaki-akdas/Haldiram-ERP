# Preview Deployments

Every pull request gets its own staging deployment on Vercel, deployed by the
`Preview Deploy` workflow (`.github/workflows/preview.yml`).

- The workflow pulls the project's **preview** environment variables, builds,
  and deploys to a unique staging URL.
- Once the build finishes, the workflow comments the staging URL on the PR.
- Staging URLs are protected by Vercel's deployment protection — reviewers need
  access to the `zaki-akdas-projects` team to open them.

This is a test PR used to verify the end-to-end flow.
