# Security Policy

## Reporting a Vulnerability

Do not open public GitHub issues for security vulnerabilities.

Report potential vulnerabilities privately:

- Email: [security@betterdata.co](mailto:security@betterdata.co)
- Include repository name (`loopengine/loop-engine`)
- Include reproduction steps, affected versions, and impact assessment

We will acknowledge receipt as quickly as possible and keep you informed on
triage, remediation, and disclosure timing.

## Supported Versions

Loop Engine is currently in early release. We prioritize fixes for:

- Latest published minor release
- Current main branch

## Disclosure Process

1. Receive and validate report
2. Reproduce and assess severity
3. Prepare and test remediation
4. Publish patch release and advisory
5. Credit reporter when requested

## Coordinated Disclosure Timeline

Loop Engine follows a 90-day coordinated disclosure policy by default.
If a fix is ready sooner, we publish sooner. If coordination requires more
time, we may extend the timeline in agreement with the reporter.

## Security Boundaries

Loop Engine is an OSS workflow runtime and does not include hosted Better Data
control-plane services. Reports should focus on this repository's code,
packages, and published artifacts.
