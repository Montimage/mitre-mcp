# Security Policy

## Supported Versions

The following versions of `mitre-mcp` are currently supported with security updates:

| Version | Supported          | Notes                                       |
| ------- | ------------------ | ------------------------------------------- |
| 0.2.x   | :white_check_mark: | Current stable release - actively supported |
| 0.1.x   | :x:                | End of life - please upgrade to 0.2.x       |
| < 0.1.0 | :x:                | Not supported                               |

**Recommendation:** Always use the latest 0.2.x release to ensure you have the most recent security patches and features.

## Security Considerations

### Data Security

- **MITRE ATT&CK Data**: This server fetches and caches MITRE ATT&CK data from official sources. Data is validated using STIX bundle validation.
- **Local Caching**: ATT&CK data is cached locally in JSON format. Ensure proper file system permissions on the cache directory.
- **HTTPS Verification**: All external requests use HTTPS with certificate verification enabled.

### Network Security

- **HTTP Server Mode**: When running with `--http` flag, the server binds to `localhost:8000` by default.
  - **⚠️ Production Warning**: Do not expose the HTTP server directly to the internet without proper authentication and reverse proxy.
  - **CORS**: CORS is enabled by default for local development. Configure `MITRE_ENABLE_CORS=false` in production environments behind a reverse proxy.

### Input Validation

- All user inputs (technique IDs, names, domains) are validated and sanitized
- Maximum length limits enforced on all string inputs
- Type validation for all parameters
- Protection against injection attacks

### Dependency Security

- Regular dependency updates via Dependabot
- Security scanning with:
  - **Bandit**: Python security linter (runs in CI/CD)
  - **Safety**: Dependency vulnerability checker (runs in CI/CD and daily)
  - **CodeQL**: GitHub's semantic code analysis
- Pre-commit hooks include security scanning

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue in `mitre-mcp`, please follow responsible disclosure practices:

### 🔒 Private Reporting (Preferred)

**For sensitive security issues**, please report privately:

1. **GitHub Security Advisories** (Recommended):
   - Navigate to https://github.com/Montimage/mitre-mcp/security/advisories
   - Click "Report a vulnerability"
   - Provide detailed information about the vulnerability

2. **Email**: Send details to **luong.nguyen@montimage.eu**
   - Use subject line: `[SECURITY] mitre-mcp: [Brief Description]`
   - Include version affected, steps to reproduce, and potential impact

### 📧 What to Include

Please provide the following information:

- **Description**: Clear description of the vulnerability
- **Impact**: Potential security impact and attack scenarios
- **Affected Versions**: Which versions are affected
- **Reproduction Steps**: Detailed steps to reproduce the issue
- **Proof of Concept**: If applicable, code or screenshots demonstrating the issue
- **Suggested Fix**: If you have ideas for remediation
- **Credit**: How you'd like to be credited (or if you prefer to remain anonymous)

### ⏱️ Response Timeline

- **Initial Response**: Within 48 hours of report
- **Triage**: Within 1 week we'll confirm if it's a valid security issue
- **Updates**: You'll receive updates at least every 2 weeks on progress
- **Resolution**: Security fixes are prioritized and typically released within 30 days for critical issues

### 🎯 What to Expect

**If Accepted:**

- We'll work with you to understand and reproduce the issue
- A security advisory will be drafted (privately)
- A patch will be developed and tested
- A CVE may be requested for significant vulnerabilities
- You'll be credited in the security advisory (if desired)
- Fix will be released as a security patch
- Public disclosure after patch is available

**If Declined:**

- We'll explain why we don't consider it a security vulnerability
- You'll receive guidance on proper usage if it's a misconfiguration
- We may create a regular issue if it's a non-security bug

### 🚫 Please Do Not

- **Publicly disclose** the vulnerability before a fix is available
- **Exploit** the vulnerability beyond what's necessary to demonstrate it
- **Violate privacy** of other users while researching
- **Perform DoS attacks** against public instances
- **Spam** multiple channels with the same report

### 🏆 Recognition

We maintain a [Security Hall of Fame](https://github.com/Montimage/mitre-mcp/security/advisories) for responsible disclosure. Contributors will be:

- Credited in the security advisory
- Mentioned in release notes (if desired)
- Listed in our acknowledgments

## Security Best Practices for Users

### Installation

```bash
# Always verify package integrity from PyPI
pip install mitre-mcp --require-hashes

# Or verify the signature (when available)
pip install mitre-mcp --trusted-host pypi.org
```

### Configuration

1. **File Permissions**: Restrict access to data directory

   ```bash
   chmod 700 ~/.local/share/mitre-mcp/data
   ```

2. **Environment Variables**: Use environment files with proper permissions

   ```bash
   chmod 600 .env
   ```

3. **HTTP Server**: If exposing via HTTP, use a reverse proxy with authentication

   ```nginx
   # Example: Nginx with basic auth
   location /mcp {
       auth_basic "Restricted";
       auth_basic_user_file /etc/nginx/.htpasswd;
       proxy_pass http://localhost:8000;
   }
   ```

4. **Network Isolation**: Run in isolated environments when possible
   ```bash
   # Docker example with network isolation
   docker run --network none mitre-mcp
   ```

### Regular Updates

```bash
# Check for security updates
pip list --outdated | grep mitre-mcp

# Update to latest secure version
pip install --upgrade mitre-mcp

# Review changelog for security fixes
pip show mitre-mcp
```

## Security Audits

- **Last Security Audit**: Never (community contributions welcome)
- **Automated Scanning**: Daily (Dependabot, CodeQL, Safety)
- **Penetration Testing**: Not formally conducted

We welcome security researchers to audit our code and report findings responsibly.

## Security Contacts

- **Primary**: luong.nguyen@montimage.eu
- **GitHub Security**: https://github.com/Montimage/mitre-mcp/security/advisories
- **General Issues**: https://github.com/Montimage/mitre-mcp/issues (for non-security bugs)

## Related Security Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE/SANS Top 25](https://cwe.mitre.org/top25/)
- [Python Security Best Practices](https://python.readthedocs.io/en/latest/library/security_warnings.html)
- [MITRE ATT&CK Framework](https://attack.mitre.org/)

---

**Last Updated**: 2025-11-17
**Version**: 1.0

Thank you for helping keep `mitre-mcp` secure! 🔒
