# Authentication Strategies for LoseIt Data Service

This document outlines authentication approaches for building a multi-user service that automates LoseIt data exports, given that LoseIt has no official API.

## Session Token Analysis

### LoseIt Session Duration: **~14 Days**

Key authentication cookies identified:

| Cookie | Duration | Security Flags | Size |
|--------|----------|----------------|------|
| `liauth` | 13-14 days | HttpOnly, Secure, SameSite=Lax | 284 chars |
| `fn_auth` | 13-14 days | HttpOnly, Secure, SameSite=Lax | 284 chars |
| `fn_authed` | 13-14 days | Secure, SameSite=Lax | 1 char |

**Key Findings:**
- Sessions last approximately 2 weeks
- Tokens are properly secured (HttpOnly prevents JavaScript access)
- Users would need to re-authenticate ~2x per month
- Sufficient duration for daily automated exports

---

## Architecture Options

### Option 1: Credential Storage

**How it works:**
- Users provide LoseIt email/password to your service
- Store credentials encrypted (AES-256 with user-specific keys)
- Run Playwright automation server-side on schedule
- Store exported data in per-user database schemas

**Architecture:**
```
User → Web App → Encrypted Credential Storage
                      ↓
                Playwright Workers (queue)
                      ↓
                LoseIt.com (automated login)
                      ↓
            PostgreSQL (multi-tenant + MCP)
```

**Pros:**
- ✅ Fully automated
- ✅ Works with existing accounts
- ✅ No user intervention after setup

**Cons:**
- ❌ **Major security/liability risk** - storing third-party credentials
- ❌ **Likely ToS violation** - automated access without permission
- ❌ **Trust barrier** - users must trust you with passwords
- ❌ **Brittle** - breaks if LoseIt changes login flow
- ❌ **Rate limiting** concerns at scale

**Verdict:** ⚠️ **Not Recommended** - too much risk

---

### Option 2: Browser Extension (Recommended)

**How it works:**
- Users install your browser extension
- Extension runs in their browser with existing LoseIt session
- Extension exports data and sends to your API
- No credentials stored on your servers

**Architecture:**
```
User's Browser
  ├─ LoseIt.com (user's active session)
  └─ Your Extension
       └─ Export data → Your API
                          ↓
                   PostgreSQL + MCP Server
```

**Implementation:**
```javascript
// Chrome Extension - manifest.json
{
  "permissions": ["storage", "cookies"],
  "host_permissions": ["https://*.loseit.com/*"],
  "content_scripts": [{
    "matches": ["https://www.loseit.com/*"],
    "js": ["content.js"]
  }]
}

// content.js - extract cookies from active session
chrome.cookies.getAll({domain: '.loseit.com'}, async (cookies) => {
  const authCookies = cookies.filter(c =>
    ['liauth', 'fn_auth', 'fn_authed'].includes(c.name)
  );

  await fetch('https://your-service.com/api/session', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${userToken}` },
    body: JSON.stringify({ cookies: authCookies })
  });
});
```

**Pros:**
- ✅ **No credential storage** - runs in user's browser
- ✅ **Uses existing session** - user already authenticated
- ✅ **More secure** - credentials never touch your servers
- ✅ **Better UX** - one-click export button
- ✅ **User-controlled** - extension can be disabled anytime

**Cons:**
- Requires extension approval/distribution (Chrome Web Store)
- Users must manually install
- Extension maintenance required
- Still scraping (but user-initiated is more defensible)

**Verdict:** ✅ **Recommended** - best security/UX balance

---

### Option 3: Session Token Proxy

**How it works:**
- User authenticates in your web app (Playwright popup)
- Extract session cookies after successful login
- Store session tokens temporarily (not passwords)
- Use tokens for automated exports until expiry
- Prompt re-authentication every ~12 days

**Architecture:**
```
Your Web App
  ├─ Embedded auth flow (Playwright)
  ├─ Extract cookies → Encrypted storage
  └─ Schedule daily exports (13 days max)
       ↓
  LoseIt.com (using session tokens)
       ↓
  PostgreSQL + MCP Server
```

**Implementation:**
```typescript
class LoseItSession {
  private cookies: Cookie[];
  private expiresAt: Date;

  constructor(cookies: Cookie[]) {
    this.cookies = cookies;
    const authCookies = cookies.filter(c =>
      ['liauth', 'fn_auth', 'fn_authed'].includes(c.name)
    );
    this.expiresAt = new Date(
      Math.min(...authCookies.map(c => c.expires * 1000))
    );
  }

  isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  daysUntilExpiry(): number {
    return Math.floor(
      (this.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
  }

  async exportWithSession(browser: Browser): Promise<Buffer> {
    const context = await browser.newContext();
    await context.addCookies(this.cookies);

    const page = await context.newPage();
    const downloadPromise = page.waitForEvent('download');
    await page.goto('https://www.loseit.com/export/data');

    const download = await downloadPromise;
    return await download.createReadStream();
  }
}
```

**User Flow:**
```
Day 1:  User authenticates → session tokens stored
Day 2-13: Automatic daily exports ✓
Day 12: Email: "Re-authentication needed soon"
Day 14: Session expires → re-auth required
```

**Database Schema:**
```sql
CREATE TABLE user_sessions (
  user_id UUID PRIMARY KEY,
  loseit_cookies JSONB NOT NULL,  -- Encrypted
  expires_at TIMESTAMP NOT NULL,
  last_export_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Auto-cleanup expired sessions
CREATE INDEX idx_sessions_expiry ON user_sessions(expires_at);
```

**Pros:**
- ✅ **No password storage** - only session tokens
- ✅ **Tokens naturally expire** - limited breach window (14 days)
- ✅ **Fully automated** between re-auths
- ✅ **Acceptable re-auth frequency** - 2x/month

**Cons:**
- Still storing sensitive tokens
- Users must re-authenticate every 2 weeks
- Complex session management
- Likely still violates ToS

**Verdict:** ⚡ **Viable Compromise** - better than passwords

---

### Option 4: User-Hosted Workers (Hybrid)

**How it works:**
- Users run a lightweight Docker container on their machine
- Container stores credentials locally (never sent to your servers)
- Worker performs exports and uploads data to your hosted DB
- You only host the database + MCP server

**Architecture:**
```
User's Machine:
  Docker Container
    ├─ Export worker (your code)
    ├─ .env file (credentials stored locally)
    └─ Scheduled exports → Your API
                             ↓
Your Cloud:
  PostgreSQL (multi-tenant, user isolation)
    ↓
  MCP Server (serves user's data to Claude Desktop)
```

**Docker Setup:**
```bash
# User runs on their machine
docker run -d \
  -e LOSEIT_EMAIL=user@example.com \
  -e LOSEIT_PASSWORD=secret \
  -e SERVICE_URL=https://your-service.com \
  -e USER_API_KEY=user-specific-token \
  --name loseit-exporter \
  your-service/exporter:latest
```

**Worker Implementation:**
```typescript
// Worker runs in user's Docker container
async function scheduledExport() {
  // Credentials stored in local .env (never sent to service)
  const email = process.env.LOSEIT_EMAIL;
  const password = process.env.LOSEIT_PASSWORD;
  const apiKey = process.env.USER_API_KEY;

  // Run export locally
  const zipData = await runPlaywrightExport(email, password);

  // Upload to service
  await fetch(`${process.env.SERVICE_URL}/api/import`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: zipData
  });
}

// Cron: daily at 2am
schedule.scheduleJob('0 2 * * *', scheduledExport);
```

**Pros:**
- ✅ **No credential storage on servers** - stays on user's machine
- ✅ **Fully automated** once configured
- ✅ **Scalable** - each user runs own export
- ✅ **User control** - can inspect/modify worker

**Cons:**
- Users must run Docker container
- More complex setup/troubleshooting
- Users need always-on machine
- Still automation (ToS concerns)

**Verdict:** 🔧 **Advanced Option** - for technical users

---

## Security Best Practices

### If Storing Session Tokens

```typescript
import { createCipheriv, createDecipheriv, scrypt } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

// Derive encryption key from user's service password
async function deriveKey(userPassword: string, salt: string): Promise<Buffer> {
  return (await scryptAsync(userPassword, salt, 32)) as Buffer;
}

// Encrypt session cookies
async function encryptCookies(
  cookies: Cookie[],
  userKey: Buffer
): Promise<EncryptedCookies> {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', userKey, iv);

  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(cookies), 'utf8'),
    cipher.final()
  ]);

  return {
    encrypted: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64')
  };
}

// Database schema
CREATE TABLE user_sessions (
  user_id UUID PRIMARY KEY,
  encrypted_cookies TEXT NOT NULL,
  encryption_iv TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  key_salt TEXT NOT NULL,  -- For deriving encryption key
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- User encryption key is NEVER stored in database
-- It's derived from user's service password on each use
```

### Security Checklist

- [ ] **Separate credentials database** from main data
- [ ] **Encrypt at rest** - all session tokens encrypted
- [ ] **Audit logging** - track all token usage
- [ ] **Auto-expiry** - delete sessions after 14 days
- [ ] **User revocation** - instant token deletion
- [ ] **Rate limiting** - prevent abuse
- [ ] **Security monitoring** - detect anomalies
- [ ] **Incident response plan** - for breaches
- [ ] **Regular security audits** - penetration testing
- [ ] **Cyber insurance** - coverage for data breaches

---

## Legal & Terms of Service

### ⚠️ Important Considerations

**LoseIt Terms of Service:**
- Automated scraping likely violates ToS
- No official API or data export partnership exists
- Risk of account termination for users
- Risk of legal action for service provider

### Recommendations:

1. **Reach out to LoseIt** - request official API or partnership
2. **Consult legal counsel** - before launching service
3. **Clear user agreements:**
   ```
   By connecting your LoseIt account, you acknowledge:
   - This is an unofficial third-party service
   - Automated exports may violate LoseIt's Terms of Service
   - Your LoseIt account could be terminated
   - You use this service at your own risk
   - You are responsible for your LoseIt account
   ```

4. **Transparency** - clearly communicate risks to users
5. **User assumption of risk** - explicit consent required
6. **Terms indemnification** - protect yourself legally

---

## Recommended Implementation Path

### Phase 1: Self-Service (Current)
- ✅ Users run export script themselves
- ✅ Provide easy setup documentation
- ✅ You host MCP server template/docs only
- **Risk:** Low - users control their own data

### Phase 2: Browser Extension
- Build Chrome/Firefox extension
- One-click export to your service
- No credential storage required
- **Risk:** Medium - still automated but user-initiated

### Phase 3: Session Token Service (Optional)
- For users wanting full automation
- Store session tokens (not passwords)
- Re-auth every 2 weeks
- **Risk:** High - requires careful security implementation

### Phase 4: Enterprise/Partnership
- Partner with LoseIt for official API
- Build legitimate integration
- **Risk:** None - official support

---

## Example User Experience

### Browser Extension Flow

```
┌─────────────────────────────────────────┐
│  1. User installs extension             │
├─────────────────────────────────────────┤
│  2. User logs into LoseIt normally      │
├─────────────────────────────────────────┤
│  3. Extension button appears in toolbar │
├─────────────────────────────────────────┤
│  4. Click "Export to Service"           │
├─────────────────────────────────────────┤
│  5. Extension:                          │
│     - Extracts session cookies          │
│     - Triggers LoseIt export            │
│     - Uploads to your service           │
├─────────────────────────────────────────┤
│  6. Data available in Claude Desktop    │
└─────────────────────────────────────────┘
```

### Session Token Service Flow

```
┌─────────────────────────────────────────┐
│  Connect Your LoseIt Account            │
├─────────────────────────────────────────┤
│  This enables automated daily exports   │
│  for the next 14 days.                  │
│                                         │
│  ℹ️  What happens:                      │
│  • Secure login popup opens             │
│  • Your session is saved (encrypted)    │
│  • Daily exports run automatically      │
│  • Re-authenticate every 2 weeks        │
│                                         │
│  🔒 Security:                           │
│  • Your password is never stored        │
│  • Sessions auto-expire in 14 days      │
│  • Revoke access anytime                │
│                                         │
│  ⚠️  Disclaimer:                        │
│  • Unofficial third-party service       │
│  • May violate LoseIt ToS               │
│  • Use at your own risk                 │
│                                         │
│  [Continue to Login] [Learn More]       │
└─────────────────────────────────────────┘
```

---

## Conclusion

**Recommendation:** Start with **Browser Extension** approach
- Best security posture
- Best user experience
- Most defensible legally (user-initiated)
- Easiest to build user trust
- Progressive enhancement possible

The 14-day session duration makes token-based automation viable for users who want full automation, but the browser extension provides the best balance of security, usability, and legal defensibility.

---

## Additional Resources

- **Cookie Inspector Script:** `inspect-cookies.ts` - diagnose session tokens
- **Export Script:** `export-data.ts` - current implementation
- **Database Schema:** `db/schema.sql` - PostgreSQL structure
- **MCP Server:** `mcp-server.ts` - Model Context Protocol implementation

---

*Last Updated: 2025-12-01*
