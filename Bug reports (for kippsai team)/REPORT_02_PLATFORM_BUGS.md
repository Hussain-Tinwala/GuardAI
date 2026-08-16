# 🐛 Platform Issue Report: Kipps AI Analytics & Concurrency State Locking

**Submitted by:** Hussain Tinwala

**Target Platform:** Kipps AI Dashboard & Voice API (`backend.kipps.ai`)

**Workspace ID:** `removed`

**Date:** August 12, 2026

---

## Executive Summary

During the integration and testing of an automated n8n Voice Escalation workflow, two critical platform-level bugs were identified within the Kipps AI ecosystem:

1. **Frontend State Synchronization Issue:** Temporary local state mutation in the Campaign Analytics UI displays inaccurate call counts (`Success = 1`) upon card interactions before reverting on full component re-render (`Success = 0`).
2. **Backend Concurrency Soft-Lock (Zombie Campaign State):** Outbound campaigns that finish dialing their entire contact audience fail to execute a `COMPLETED` state transition. As a result, the active session record remains soft-locked in the organization database, blocking external API triggers via `POST /speech/phone-call/` with a `403 Maximum concurrent calls limit reached` error.

---

## Bug 1: Campaign Analytics React State / Re-rendering Inconsistency

### Bug Classification

* **Severity:** Medium
* **Category:** UI / Frontend State Management (React Re-rendering & Cache Invalidation)

### Steps to Reproduce

1. Open an existing campaign in the Kipps AI Dashboard (`/campaigns/<campaign_id>`).
2. Observe the initial analytics metrics (e.g., `Success: 0`, `Call Cut: 1`).
3. Click directly on the **Success** metric card.
4. Navigate back to the main Campaign Dashboard or re-open the Analytics view.
5. Observe that the UI temporarily renders `Success: 1`.
6. Perform a hard browser refresh or re-fetch from the database; the value reverts to `Success: 0`.

### Expected Behavior

The UI analytics panel should remain strictly bound to immutable backend query responses and accurately reflect real-time database logs without local state mutation quirks upon UI element interaction.

### Actual Behavior

Interacting with analytics cards causes transient frontend state updates, momentarily presenting inaccurate success metrics to the user.

---

## Bug 2: Zombie Campaign State & API Concurrency Lockout (`HTTP 403`)

### Bug Classification

* **Severity:** High / Critical (Blocks Programmatic API Integrations)
* **Category:** Backend State Machine / Session Lifecycle Management

### Technical Context & Payload

* **Endpoint:** `POST [https://backend.kipps.ai/speech/phone-call/](https://backend.kipps.ai/speech/phone-call/)`
* **Headers:**
* `X-Organization-ID: removed`
* `Authorization: <Valid_API_Key>`


* **Request Body:**

```json
{
  "voicebot": "<VOICEBOT_ID>",
  "phone_number": "+919876543210",
  "to_phone_number": "+919876543210",
  "from_phone_number": "+91XXXXXXXXXX",
  "room_name": "escalation_session"
}

```

### Steps to Reproduce

1. Create and launch a single-contact Outbound Campaign in the Kipps AI UI.
2. Allow the campaign call to complete or end (e.g., logged as `Call Cut`).
3. Observe that the campaign status remains permanently stuck on `Active` or `Paused` with no option to manually terminate or delete the campaign.
4. Dispatch a valid programmatic HTTP `POST` request from n8n to `/speech/phone-call/` targeting the same organization (`removed`).

### Expected Behavior

Upon exhausting the audience list, the campaign engine should invoke an automated lifecycle transition:


$$\text{Campaign Status: } \text{ACTIVE} \longrightarrow \text{COMPLETED}$$


This transition should release the active SIP session lock and reset the workspace concurrency counter to `0`.

### Actual Behavior

The campaign engine leaves the session marked as active in the underlying database/Redis cache. When the external API call is received, the middleware evaluates the active session table:


$$\text{Active Sessions}(\text{removed}) = 1 \ge \text{Max Plan Concurrency} (1)$$


The API aborts the call request and returns the following error:

```json
{
  "status": 403,
  "error": "Maximum concurrent calls limit reached for your plan."
}

```

---

## Impact & Proposed Fixes

### Platform Impact

Developer applications attempting to orchestrate dynamic voice calls via n8n, Zapier, or custom REST webhooks become permanently blocked if any previous UI campaign was executed within the same workspace environment.

### Suggested Remediation for Kipps Engineering

1. **Frontend Fix:** Ensure React state hooks handling campaign metrics directly reflect backend REST/GraphQL response payloads and do not mutate on card click events.
2. **Backend Lifecycle Fix:** Implement an explicit queue auditor in the campaign execution worker:
```python
# Pseudocode Logic Check
if remaining_audience_count == 0 and active_calls_in_queue == 0:
    campaign.status = CampaignStatus.COMPLETED
    campaign.save()
    redis_client.decr(f"concurrency:{organization_id}")

```


3. **Admin Option:** Add a manual **"Force Terminate / Delete Campaign"** button in the Campaign Action menu (`⋮`) to allow users to flush orphaned session locks manually.