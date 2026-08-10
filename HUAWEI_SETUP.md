# Huawei Band 11 and Huawei Health setup

Roval's Health dashboard is intentionally separate from habit scoring. Wearable
values never change habit percentages, weights, streaks, or planner completion.

## What works immediately: file import

1. Pair the Band 11 in Huawei Health.
2. Make sure Huawei Health has synchronized the band and, if desired, enabled
   cloud synchronization under its privacy/data syncing settings.
3. Request/export Huawei Health data from Huawei's privacy/account tools.
4. Extract the export.
5. In Roval, open **Health → Connect Huawei → Choose Huawei files**.
6. Select supported JSON files or use Roval's CSV template.
7. Roval normalizes recognized daily summaries and stores only those normalized
   values in the Roval health dataset.

Supported normalized fields:

`date`, `steps`, `calories`, `activeMinutes`, `workouts`,
`restingHeartRate`, `hrv`, `spo2`, `stress`, `sleepMinutes`,
`deepSleepMinutes`, and `remSleepMinutes`.

## Best personal Android path: Huawei Health → Health Connect → Roval Android

Huawei's current Huawei Health privacy documentation states that Huawei Health
can share fitness and sleep data to Android Health Connect when the user enables
that sharing.

A normal website/PWA cannot read Android Health Connect directly. To use this
path, Roval needs a small native Android shell/bridge:

1. Keep the existing Roval web UI.
2. Package it as an Android app shell.
3. Request only the Health Connect read permissions Roval needs.
4. Read supported records locally after the user grants Android permission.
5. Convert them to Roval's normalized daily `HealthEntry` format.
6. Send them into the same Roval cloud state used by manual/file health data.
7. Provide a disconnect/revoke control and allow health records to be removed.

This route is attractive for a personal Android installation because the phone
performs the authorization and data read. Exact metrics available through
Huawei Health's Health Connect sharing can vary; do not assume every Huawei-only
signal such as stress or every recovery metric will be present.

## Cross-platform automatic path: Huawei Health Service Kit / Health Kit REST

Huawei Health Service Kit supports user-authorized health and fitness data access
for apps/services, and its REST APIs are designed for cloud/cross-platform use.
This is the right route when Roval should synchronize from a Huawei account
without relying on a specific Android phone.

Production setup requires Huawei developer access and the permissions Huawei
approves for the Roval app/service.

1. Create/verify a Huawei Developer account.
2. Create the required app/service configuration in Huawei's developer console.
3. Enable Health Service Kit/Health Kit.
4. Request only the read data scopes Roval needs.
5. Configure Roval's production OAuth callback URL.
6. Complete Huawei's privacy/data-use/review requirements.
7. Store the issued client credentials only as server secrets.
8. Implement authorization-code OAuth, token refresh, server-side token storage,
   Health Kit REST queries, disconnect/revoke, and deletion.
9. Normalize returned Huawei records to Roval's existing daily `HealthEntry`
   fields before saving them.

Huawei's REST documentation currently exposes Health Kit cloud APIs under the
`health-api.cloud.huawei.com/healthkit` service, including v2 cloud-side data
interfaces. Do not hard-code scopes or data-type identifiers until the Roval
Huawei developer project has been approved and the exact enabled data types are
visible in its console.

## Security requirements

- Request the minimum health scopes.
- Never put Huawei client secrets or refresh tokens in browser JavaScript,
  GitHub, a downloadable ZIP, or localStorage.
- Encrypt long-lived provider tokens at rest on the server.
- Keep Roval's per-user account boundary when storing imported/synced health.
- Let a user disconnect Huawei and delete Roval's imported health values.
- Treat Band values as wellness context, not medical diagnosis.

## Recommended order for Roval

1. Keep JSON/CSV import as a reliable fallback.
2. Add the Android Health Connect bridge if the main use case is your own Android
   phone + Band 11.
3. Add Health Kit REST after the Huawei developer project and scopes are approved.
