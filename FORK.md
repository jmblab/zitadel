# JMBLab fork

## Base and Login V2 fix

The initial fork build is based on upstream `v4.20.2` (commit
`dce17d591309b1c0cdfb6c6718ec6cfada05eb7d`, also the `v4.x` tip when prepared).
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

**Fork CI** runs API unit tests for PRs and pushes to `main` / `v4.x`.
It also runs before every fork release. This is not the complete upstream test
suite: API integration, browser E2E tests, and the upstream lint tooling are not
included in this workflow.

## Publish a build

1. Open **Actions → Fork release → Run workflow**.
2. Select `v4.x` for the maintained v4 build.
3. Enter a new version, initially `v4.20.2-jmblab.1`.
4. Run the workflow. It validates the upstream base tag and rejects an existing
   fork tag, runs API checks, builds the embedded console and Linux binaries,
   builds/tests Login UI, and publishes both multi-architecture images.
5. After both images are published, it creates the Git tag and a GitHub
   prerelease with Linux archives, the Login archive, checksums, and image digests.

Images are:

```text
ghcr.io/jmblab/zitadel:v4.20.2-jmblab.1
ghcr.io/jmblab/zitadel-login:v4.20.2-jmblab.1
```

Both support `linux/amd64` and `linux/arm64`. The build does not publish FIPS,
debug, or `latest` images. Use a version tag or the release's digest in deployment
configuration. For a custom Login UI, only the patched API image is needed.
For the upstream Login V2 UI, use the matching Login image as well.

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
