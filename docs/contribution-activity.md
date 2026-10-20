# Contribution activity

The profile chart is generated from GitHub GraphQL `contributionsCollection.contributionCalendar`, not repository commit enumeration, the Events API, or estimated totals. It shows exactly 365 calendar dates ending today, monthly sums, and the last 30 calendar dates. Today and the first/last months can be incomplete. Dates are GitHub's calendar dates; the fetch window and update timestamp use UTC.

## Coverage and setup

The workflow runs every six hours and can be run manually from **Actions  Update contribution calendar  Run workflow**. Scheduled jobs can be delayed; the SVG always shows its actual update time. GitHub can disable schedules after 60 days of inactivity in a public repository; re-enable the workflow if necessary.

1. On your GitHub profile, open **Contribution settings  Private contributions** to share anonymized private contribution counts. This is a privacy choice; the automation does not change this account setting.
2. The default `GITHUB_TOKEN` is restricted to this profile repository. It does not gain access to other private repositories. If GitHub returns nonzero `restrictedContributionsCount`, the chart labels the calendar **Public + shared private contributions**. Zero does not prove there is no private work; otherwise coverage remains **API-visible contributions; private coverage unverified**.
3. For an owner-authorized query, create an expiring **classic personal access token** with only **`read:user`** and save it as the repository Actions secret **`PROFILE_CONTRIBUTIONS_TOKEN`**. Do not grant `repo`, `workflow`, or write scopes. Do not paste the token into README, an issue, source code, or chat. Organization policies may limit visibility. A fine-grained token is not supported by this implementation's explicit classic-scope verification.
4. Run the workflow. It checks that an optional token belongs to `skyfelongrock` and reports `read:user` (or its parent `user`) in GitHub's scope header. The chart then labels the data **Public + private contributions returned to owner (read:user)**. This describes the API result, not all work performed or all commits across every branch. Compare the same dates on GitHub's native contribution calendar. No fixed target total is assumed.

Private contributions are never added to `totalContributions`: the calendar already supplies the total. `restrictedContributionsCount` means contributions inaccessible to the querying viewer, not necessarily all private contributions. It is used only as a coverage signal.

## Safety and failure behavior

The only API fields requested are viewer login, daily dates/counts, calendar total, and restricted count. No repository names, commit messages, source files, issue titles, or private URLs are requested. The API response is kept in memory. Only `assets/contributions.svg` is committed. The optional read token is confined to the fetch step; the separate built-in repository token publishes the SVG.

Checkout is pinned to a verified commit and does not persist credentials. No third-party chart action runs with the token. There is no pull-request trigger. The workflow grants only the update job `contents: write`, serializes updates, stages only the SVG, and uses a normal push without force. Missing dates, duplicate dates, negative counts, inconsistent totals, GraphQL errors, and invalid owner-token permissions fail the update and keep the previous committed image. Its timestamp makes stale data visible. A failed configured token never silently falls back to a smaller total.

Verify locally with `node --test scripts/contributions.test.mjs`. Tests use synthetic data that is never published as profile statistics.

## Why the previous card can differ

The hosted `github-profile-summary-cards.vercel.app` card queries GitHub with the service's token and caches its result. Its current upstream calendar query also uses `contributionCalendar`; it is not inherently a public-commit-only counter. However, its viewing identity, token scopes, private contribution setting, cache freshness, date range, and additional all-time/public repository counters can differ from the profile owner's view. This repository's SVG makes the requested window, last-30-day total, coverage, and refresh timestamp explicit.

GitHub's rules still apply, including commit email attribution and default-branch / `gh-pages` requirements. Contributions include supported activity such as commits, issues, pull requests, and reviews; they are not hours worked or a raw count of all Git commits. The 30-day total must not be compared with a full calendar month or the previous card's all-time counters.

References:

- [GitHub contribution rules](https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference)
- [GraphQL contributions collection and calendar](https://docs.github.com/en/graphql/reference/users#contributionscollection)
- [Private contribution visibility](https://docs.github.com/en/account-and-profile/how-tos/contribution-settings/manage-visibility-settings-for-private-contributions-and-achievements)
- [GITHUB_TOKEN scope](https://docs.github.com/en/actions/concepts/security/github_token)
- [Previous chart's upstream query](https://github.com/vn7n24fzkq/github-profile-summary-cards/blob/main/src/github-api/profile-details.ts)

