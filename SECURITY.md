# Security Policy

## Supported Scope

This repository is intended for portfolio and production-style application development. Security reports should focus on:

- authentication and authorization flaws
- data exposure or privacy issues
- secret handling and environment leaks
- Supabase policy or access-control weaknesses
- abuse and rate-limiting gaps
- client/server boundary issues in the Next.js app

## Reporting a Vulnerability

Do not open a public GitHub issue for a suspected security problem.

Instead, report vulnerabilities privately to the project maintainer with:

- a concise description of the issue
- affected routes, files, or components
- reproduction steps or proof of concept
- impact assessment
- any suggested remediation

If a dedicated security contact is later added, this policy should be updated to reference it directly.

## Disclosure Expectations

- Please allow reasonable time for investigation and remediation before public disclosure.
- Avoid accessing, modifying, or exfiltrating real user data.
- Avoid denial-of-service testing against live deployments.

## Out of Scope

The following are generally out of scope unless they create a clear security impact:

- purely informational missing headers already documented by the project
- version disclosure without exploitability
- self-XSS that requires pasting code into the browser console
- issues requiring compromised developer credentials or local machine access
