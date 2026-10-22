# QuickEx Security Documentation

## Overview

QuickEx is committed to maintaining the highest security standards for its users. This document provides an overview of our security practices and links to our vulnerability disclosure policy.

## Security Policy

For information about reporting security vulnerabilities, supported versions, response SLAs, and our responsible disclosure process, see [SECURITY.md](../SECURITY.md).

## Security Features

### Privacy & Self-Custody
- **X-Ray Privacy**: Optional zero-knowledge proof-based privacy features for shielded transactions
- **Self-Custody**: All funds route directly to user wallets with no central holding
- **Stealth Addresses**: Privacy-preserving payment mechanisms (Privacy v2)

### Protection Mechanisms
- **Scam Alerts**: Automated detection and flagging of suspicious payment links
- **Smart Contract Security**: Escrow contracts with dispute resolution, time-locked refunds, and emergency pause mechanisms
- **Input Validation**: Comprehensive validation on all user inputs across frontend and backend
- **Rate Limiting**: Protection against abuse and brute-force attacks

### Infrastructure Security
- **CORS Protection**: Restricted origins to prevent cross-site request forgery
- **Authentication**: Secure authentication mechanisms for API access
- **Monitoring**: Prometheus metrics and structured logging for threat detection

## Reporting Security Issues

If you discover a security issue, please follow our [Responsible Disclosure Process](../SECURITY.md#reporting-a-vulnerability). Do not publicly disclose vulnerabilities without giving us time to address them.

## Security Contacts

- **Security Team**: [security@quickex.to](mailto:security@quickex.to)
- **GitHub Security Advisories**: [Report privately](https://github.com/Viky207/QiuckEx/security/advisories/new)
