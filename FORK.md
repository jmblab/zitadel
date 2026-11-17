# JMBLab fork

## Base and Login V2 fix

The release branch includes upstream `v4.20.3`. The initial fork build was based
on upstream `v4.20.2` (commit `dce17d591309b1c0cdfb6c6718ec6cfada05eb7d`).
The query-layer fix for [#10722](https://github.com/zitadel/zitadel/issues/10722)
follows [#11896](https://github.com/zitadel/zitadel/pull/11896): requiring Login V2
at instance level preserves an application's custom Login URL. An absent, null,
or empty application URL falls back to the instance URL. Instance-required Login
V2 still overrides the application's login version.

This changes OIDC login URL selection; it does not make notification email links
application-specific. Instance-level Login V2 can remain enabled for those links.

Keep the Go fix and tests on both `v4.x` and `main`. Transfer those changes and
the fork workflows separately from other upstream changes; do not merge all of
`main` into `v4.x` just to obtain this fix.

## GitHub Actions setup

Before enabling Actions, merge the workflow changes into the fork's default
branch (`main`) and the release branch (`v4.x`). GitHub requires a manually
dispatched workflow to exist on the default branch before it can be selected.
The version to build is the commit of the branch selected under **Run workflow**.

The inherited CI, CodeQL, project automation, and contribution comments are
restricted to `zitadel/zitadel`. Fork workflows run only in `jmblab/zitadel` and
use standard GitHub-hosted Ubuntu runners. They do not need ZITADEL's Depot
runners, Google registry, GitHub App, Nx Cloud, or Codecov secrets.

Enable GitHub Actions and allow the actions referenced by the workflows.
Organization policy must allow the workflow's `GITHUB_TOKEN` to publish packages
and create releases. The workflow requests `packages: write` only for image
publication and `contents: write` only for the release job. No PAT is needed for
the release workflow itself.

**Fork CI** runs API unit tests and the Login UI production build/unit tests
for PRs and pushes to `main` / `v4.x`.
It also runs before every fork release. This is not the complete upstream test
suite: API integration, browser E2E tests, and the upstream lint tooling are not
included in this workflow.

## Publish a build

1. Open **Actions → Fork release → Run workflow**.
2. Select `v4.x` for the maintained v4 build.
3. Enter a new version, for example `v4.20.3-jmblab.1` for this upstream base.
4. Run the workflow. It validates the upstream base tag and rejects an existing
   fork tag, runs API checks, builds the embedded console and Linux binaries,
   builds/tests Login UI, and publishes both multi-architecture images.
5. After both images are published, it creates the Git tag and a GitHub
   prerelease with Linux archives, the Login archive, checksums, and image digests.

Images are:

```text
ghcr.io/jmblab/zitadel:v4.20.3-jmblab.1
ghcr.io/jmblab/zitadel-login:v4.20.3-jmblab.1
```

Both support `linux/amd64` and `linux/arm64`. The build does not publish FIPS,
debug, or `latest` images. Use a version tag or the release's digest in deployment
configuration. The matching Login image includes the JMBLab customizations below
and is built to run at `/` on its own domain.

GHCR packages are initially private. After the first publication, set each
package's visibility to public for anonymous pulls, or keep them private and
configure registry credentials (`read:packages`) on the deployment host / cluster.
Check package Actions access if a package with the same name already exists.

Publication is not atomic across the two images and GitHub Releases. A failed
run can leave an image without a release. Inspect the failed job before retrying;
once a fork tag exists, use a new fork version. Deploy only a completed release,
preferably pinned to its recorded digest.

After updating to another upstream version, use its tag as the prefix, for
example `v4.20.3-jmblab.1`. The workflow checks that this upstream tag is an
ancestor of the selected commit; it does not automatically update the branch.
Merge upstream integration PRs with a merge commit to preserve that tag ancestry.

## JMBLab Login UI

### Upgrading to v4.20.3

Read the [upstream release notes](https://github.com/zitadel/zitadel/releases/tag/v4.20.3)
before deployment. This update includes authentication security fixes, not only
changes to error messages.

- The Login service user must have `IAM_LOGIN_CLIENT` so it can complete OIDC
  and SAML requests. `IAM_OWNER` alone is insufficient. Check the service user
  behind the configured Login API credential.
- `x-zitadel-public-host`, when configured, must contain a single hostname with
  an optional port, without a URL scheme or path. Malformed values are rejected.
- Password authentication now enforces the user's organization's local-auth
  policy on the backend. Users in organizations that disable it must use an IdP.
- In-progress external IdP sign-ins and outstanding Login V1 authorization codes
  from before the update may require users to start signing in again.
- Adding email or SMS MFA now requires an explicit confirmation. The fork keeps
  that confirmation button disabled until navigation completes and unlocks it
  when an error allows another attempt.
- Server Actions live in `src/lib/actions/`; internal helpers live in
  `src/lib/server/`. Organization defaults and redirects follow this layout.
  The production build checks the published actions against the upstream
  allowlist. Fork customizations do not add public actions or relax session,
  browser-binding, or enrollment checks.

Use matching backend and Login UI releases and test password reset, invitation,
OIDC/SAML callbacks, IdP sign-in, MFA enrollment, logout, and organization branding
in a non-production environment before production rollout. Keep the existing
stable `ZITADEL_SESSION_COOKIE_SECRET` across restarts and replicas.

### Included behavior

- Login UI uses Next.js and its ESLint plugin at `16.4.5`, including the
  [November security fixes](https://github.com/vercel/next.js/releases/tag/v16.4.5).
  Upstream ZITADEL `v4.20.3` pins `16.4.3`; this runtime patch is maintained in
  the fork alongside the application changes.
- Invalid, expired, and missing password reset codes share a translated message
  that points to the resend-code button. Login UI does not display raw RPC errors
  or internal error IDs for password changes.
- Password visibility toggle with translated, accessible labels
  ([#11951](https://github.com/zitadel/zitadel/issues/11951),
  [#11952](https://github.com/zitadel/zitadel/pull/11952)).
- Incorrect passwords in an existing session show the appropriate authentication
  error instead of retrying by creating a new session. Attempt counts remain
  hidden when user enumeration protection is enabled
  ([#11953](https://github.com/zitadel/zitadel/issues/11953),
  [#11954](https://github.com/zitadel/zitadel/pull/11954)).
- `DEFAULT_ORGANIZATION_ID` for default branding, settings, and translations:
  explicit organization takes precedence, then this environment variable, then
  the instance default ([#10284](https://github.com/zitadel/zitadel/pull/10284)).
  It is a UI default, not an access-control boundary.
- `ORG_REDIRECTS` links and optional automatic redirect after login, including
  light/dark icons. Valid OIDC and SAML callbacks retain their protocol behavior.
- Trimmed login names, forms staying disabled while navigating, automatic skipping
  of optional MFA setup when no selectable method exists, customized Polish wording,
  and language/theme selector layout improvements.

For repeated verification emails ([#10724](https://github.com/zitadel/zitadel/issues/10724)),
the current upstream verification page already avoids sending mail during rendering.
Regression tests check that opening and rerendering a verification link verifies
once without requesting another email.

### Regression coverage for fork customizations

`Fork CI` runs the Login unit/component tests and production build, including the
Server Action allowlist check, plus API unit tests on Linux. These checks run for
pull requests and pushes to `v4.x` and `main`. A passing build is not a substitute
for testing a deployed authentication flow. Keep the tests when resolving future
upstream merges; update mocks and imports to follow upstream's boundaries.

| Customization | Automated regression coverage | Remaining verification |
| --- | --- | --- |
| Per-application Login V2 URL when the instance requires V2 | [OIDC query cases](internal/query/oidc_client_test.go) cover custom, empty, absent and fallback URLs | Real authorization request against a deployed backend |
| Organization defaults and branding | [Default precedence](apps/login/src/lib/organization.test.ts), [page context](apps/login/src/lib/organization-pages.test.tsx), [branding fallback](apps/login/src/lib/server/zitadel.test.ts), [IdP organization](apps/login/src/lib/actions/idp-intent.test.ts) | Browser checks for each deployed organization's branding and registration |
| Organization links and redirect precedence | [Configuration and icon CSP](apps/login/src/lib/org-redirects.test.ts), [navigation](apps/login/src/lib/server/next-url.test.ts), [OIDC/SAML](apps/login/src/lib/org-login-flow.test.ts), [signed-in page](apps/login/src/app/(login)/signedin/page.test.tsx) | Real RP callbacks, logout and SAML POST in a browser |
| Password attempt handling and reset-code errors | [Password action tests](apps/login/src/lib/actions/password.test.ts) cover existing sessions, enumeration protection, invalid/expired/missing reset codes and successful changes | Full reset email journey with backend state and organization policies |
| Duplicate-submit protection | [Shared response handling](apps/login/src/lib/client-loading.test.ts), plus explicit pending/navigation/error tests for password, username, LDAP, account selection, consent, passkey registration, TOTP and email/SMS MFA forms | Partial coverage: registration forms, password setup/change, U2F registration, session removal and verification continuation still lack dedicated checks for every pending/error/navigation path |
| Optional MFA and repeated effects | [MFA selection](apps/login/src/components/choose-second-factor-to-setup.test.tsx), [passkey registration](apps/login/src/components/register-passkey.test.tsx), [SAML submission](apps/login/src/components/auto-submit-form.test.tsx) | Real browser/WebAuthn behavior and backend MFA policy combinations |
| Verification links must not send a replacement email on render | [Verification form](apps/login/src/components/verify-form.test.tsx) checks first render and rerender | Actual delivery, expiry and resend against the email service |
| Password visibility and translations | [Input accessibility](apps/login/src/components/input.test.tsx), [message merging](apps/login/src/lib/server/merge-messages.test.ts) | No exhaustive test of all fork text values across local languages, embedded backend defaults and organization overrides |
| Styling, theme/layout and separate-domain image | Theme/component unit tests and the root-path production build | No visual snapshots or automated Azure/container smoke test for the fork configuration |

The highest-value additions are the remaining per-form submission cases, a
translation consistency check, and browser smoke tests for sign-in, reset,
verification, MFA and logout on the separate Login domain. Record a regression
test for each confirmed bug before the next upstream merge.

### Organization context

`DEFAULT_ORGANIZATION_ID` supplies the default UI and registration context. The
organization helper uses an explicit organization first, then the environment
variable, then the default organization returned by the API. Pages that already
resolved a user/session retain that context when reading its login policy.
The dedicated identity-provider selection page uses the same default as the
initial login page.

Branding also applies the configured fallback centrally, so secondary pages,
verification screens and error pages do not silently revert to instance branding.
Without the environment variable, those calls retain upstream's instance fallback.
This does not change the scope of user searches, session lookup or authorization.
The signed-in page reads branding and default redirect settings for the resolved
organization, including when the URL contains a completed request ID.

### Submissions and optional MFA

Forms stay disabled while a request is pending and after success while navigation
or a SAML POST is taking over. This covers login name/password, password reset and
changes, registration, LDAP, OTP, WebAuthn and verification flows. Both device
consent actions are disabled together. Session removal blocks repeated requests;
the continue button after email verification blocks repeated navigation.
Errors and responses without a usable next step unlock the affected form.
Operations that remain on the page, such as sending another code, unlock when
their request completes.

Automatic login-name submission, passkey registration and SAML form submission
are guarded against repeated React effects. Cancelled or malformed WebAuthn
registration attempts unlock the form so the user can retry. TOTP enrollment
errors returned by the backend are displayed without proceeding as if enrollment
had succeeded. The upstream identity-provider buttons retain their existing
React form pending-state handling.

Optional MFA setup is skipped once when no selectable method remains. Already
configured methods and unverified email/phone methods do not count as selectable.
Required MFA is not automatically skipped. A failed skip can be retried manually;
the continuation handles both redirects and SAML POST responses.

### Upstream behavior retained

- Authentication-method labels already use upstream's translated
  `authenticator.methods.*` and `register.methods.*` keys
  ([#12668](https://github.com/zitadel/zitadel/pull/12668)); no separate top-level
  `methods.password` key is added.
- Upstream email verification protections are retained
  ([#11893](https://github.com/zitadel/zitadel/pull/11893),
  [#11995](https://github.com/zitadel/zitadel/pull/11995)); no sending of email is
  reintroduced during server-page rendering.
- User-enumeration protection, enrollment authorization, signed verification/link
  proofs, safe redirect handling and custom application callback protocols remain
  in place. Organization portal links are a separate HTTP(S)-only configuration.
- The current upstream deep message merge is retained. Hosted translation values
  override local defaults without replacing unrelated nested messages.

### Login translations

Password visibility labels are available in all 15 supported Login languages.
The Login locale files and the API's embedded defaults in
`internal/query/v2-default.json` include the same visibility labels and Polish
text changes. Build and deploy both images to use the updated defaults.

Login merges English fallback texts, the selected local language, and then the
hosted translations returned by the API. The API response takes precedence and
can include system defaults as well as custom translations. Custom visibility
labels use `password.showPassword` and `password.hidePassword` in the hosted
translation JSON. Authentication method labels retain upstream's
`authenticator.methods.*` and `register.methods.*` keys.

### Separate Login domain

For example, serve the API at `https://auth.example.com` and this Login image at
`https://login.example.com`. Route the whole Login domain to container port 3000.
Set `ZITADEL_API_URL=https://auth.example.com` and provide the Login client's
existing service credentials using the supported token/key-file configuration.
Set a stable, strong `ZITADEL_SESSION_COOKIE_SECRET` shared by all Login replicas.
Configure Login V2's public base URI as `https://login.example.com` in ZITADEL,
including the instance default used by notification links. Preserve the external
host and protocol in trusted reverse-proxy headers.

The image's readiness endpoint is `/ready`. `NEXT_PUBLIC_BASE_PATH` is empty at
build time; changing it on an already built container cannot relocate Next.js
assets or routes. Local builds use the same root default in `apps/login/.env`.
To deliberately build a subpath variant, set `NEXT_PUBLIC_BASE_PATH=/ui/v2/login`
for the Nx build and pass the identical Docker build argument. Nx includes this
variable in its build cache key. The standard **Fork release** always builds `/`.

### Organization links

Set `ORG_REDIRECTS` at runtime to a JSON array, for example:

```json
[
  {
    "orgId": "123456789",
    "autoRedirect": false,
    "overrideDefault": true,
    "links": [
      {
        "label": "Portal",
        "url": "https://portal.example.com",
        "iconUrl": "https://assets.example.com/portal-light.svg",
        "iconDarkUrl": "https://assets.example.com/portal-dark.svg"
      }
    ]
  }
]
```

`autoRedirect: true` selects the first link; otherwise the signed-in page displays
the links. A configured ZITADEL default redirect wins unless `overrideDefault`
is true. `DEFAULT_REDIRECT_URI` remains the global override for the normal
post-login flow. Device authorization still goes through consent and shows its
completion page. Link and icon URLs must be absolute HTTP(S) URLs; invalid entries
are ignored. Only configured icon origins are added to `img-src` in CSP.

For normal completion, `DEFAULT_REDIRECT_URI` takes precedence. Organization
links take precedence over the organization's default URI only when
`overrideDefault` is true, or when no default URI exists. With `autoRedirect`
disabled, the signed-in page displays the link list. With it enabled, the first
valid link is used. Device completion still displays its completion page.

Successful OIDC callbacks and SAML responses always keep their protocol behavior.
Organization links also provide a fallback when an OIDC/SAML request has already
been handled; unrelated protocol errors remain errors. URL validation and custom
protocol support from upstream are retained for application callbacks.
