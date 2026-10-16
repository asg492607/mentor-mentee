# Security deployment notes

## Deploy Firebase rules

The repository now contains Firestore and Storage rules. Deploy them to the Firebase project used by the frontend:

```sh
firebase deploy --only firestore:rules,storage
```

Only allowlisted department and class registration metadata remains anonymously readable. Student records, faculty profiles, meetings, issues, chats, booklets, recordings, and private meeting reports require an approved account and role-based access. Faculty profile reads are scoped to the account owner, assigned mentors, the HOD's department, or administrators/deans. Meeting AI notes, transcripts, and confidential reports are stored in a backend-only collection; student meeting APIs return only student-safe minutes.

## Backend settings

Set these Render environment variables:

- `FIREBASE_PROJECT_ID`: `mentorv1-848ef`, matching `frontend/js/config.js`.
- `FIREBASE_CREDENTIALS_JSON`: a service account from that Firebase project with Firebase Authentication and Firestore access.
- `CORS_ORIGINS`: the exact deployed frontend origin, plus any required local development origins, comma separated. Wildcards are rejected.
- `GROQ_API_KEY` and/or `GEMINI_API_KEY`: optional provider credentials for the authenticated, rate-limited AI proxy. These values are never sent to frontend code.

The only anonymous backend route is `/health`. Every `/api` REST route also has an application-wide Firebase authentication dependency as a backstop, in addition to endpoint role checks. Account signup uses Firebase Authentication in the browser and Firestore rules allow only pending self-created student and faculty profiles. HOD and section-head roles must be assigned by a trusted administrator after approval. The backend no longer exposes a duplicate account-creation route. API documentation routes are disabled.

## Administrator accounts

All API, Firestore, Storage, and WebSocket access requires the trusted `platform_approved: true` custom claim as well as an approved profile. Elevated roles also require `admin: true` for administrators or `platform_role` matching `DEAN`, `HOD`, or `SECTION_HEAD`. Claims are issued only by trusted backend operations. Review existing accounts against the institution's roster before migrating them: old rules allowed client-created approved and elevated profiles, so do not grant claims mechanically to every profile. Every existing account needs this one-time review and migration before it can use protected pages and APIs. New account provisioning and approvals set claims through the backend.

## Security activity logs

The backend writes REST request events and authenticated portal page views to the backend-only `security_events` collection. Logs contain account ID/name/role when authenticated, route template, response status, duration, peer IP, an unverified forwarded-IP chain when present, and browser user-agent. Request bodies, query strings, and authorization tokens are not stored. The admin portal exposes the latest 200 events at **Security Logs**; `/api/admin/security-events` is admin-only. Unauthenticated events are rate-limited per peer address to bound log writes.

The app cannot reliably tell when browser developer tools are open. VPN/proxy classification requires a trusted IP-intelligence provider, which is not configured; the log marks it `unknown`. Forwarded IP headers are not trusted for attribution until the hosting proxy is configured to overwrite them. Firebase client SDK traffic is not visible to the backend request logger; use Google Cloud/Firebase audit logging if individual Firestore operations need server-side audit records.

## Provider keys

Groq and Gemini keys, browser-side key entry, the shared default passwords for the institutional cell accounts, and the public Drive folder link were removed from frontend code. Old browser-stored AI keys are cleared by the updated client. Revoke and replace any provider keys that were previously committed, reset the affected account passwords, remove link-wide access from existing Drive recordings and folders, and revoke legacy Firebase Storage download tokens; deleting a value from the current files does not invalidate copies in Git history or deployed assets. New Drive uploads grant access to named accounts only. Configure replacement provider keys only in the backend environment.

The Firebase web API key and project configuration must remain in browser code for Firebase client SDKs. That API key is a project identifier, not an authentication token. Restrict it in Google Cloud to the required Firebase APIs and the deployed website referrers, and keep Firebase authorization in the deployed rules.
