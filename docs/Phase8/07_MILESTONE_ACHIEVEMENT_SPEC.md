# Phase 8 — Milestone & Achievement Specification

## 1. Purpose & Conceptual Boundary

A **Milestone** (or Achievement) in the AI Personal Growth RPG is a **formal recognition layer** celebrating meaningful leaps in real-world capability, creative output, and strategic discipline.

### Critical System Invariants:
1. **Recognition Layer, Not Growth Truth (O1)**:
   A Milestone does not generate XP, does not create Skills, and does not alter historical Activity truth. It recognizes and commemorates truth that has already been verified in the Growth Core.
2. **Real-World Growth Over App Vanity (O12)**:
   Traditional games reward "vanity engagement" (e.g., "Logged in 7 days in a row", "Clicked 100 buttons", "Shared on social media"). The RPG strictly prohibits vanity achievements. Milestones recognize only authentic competence thresholds and creative artifacts.
3. **Immutability and Auditability (O9)**:
   Milestones are permanent records of personal history. If an underlying prerequisite is subsequently invalidated, the Milestone is marked `REVOKED` or `CORRECTED` with an audit note; it is never silently deleted.

---

## 2. Milestone Classification Taxonomy

Canonical Milestone records are categorized into two primary recognition classes:

```mermaid
classDiagram
    class Milestone {
        +UUID id
        +UUID user_id
        +String milestone_key
        +String title
        +String description
        +String recognition_class "CORE_VERIFIED | USER_CONFIRMED_REAL_WORLD"
        +String status "ACTIVE | REVOKED | CORRECTED"
        +String source_type "QUEST | MASTERY | ARTIFACT | SEASON | EXTERNAL_CREDENTIAL"
        +String source_id "UUID or composite identity (e.g. ${skill.id}:M6)"
        +String external_evidence_url
        +String external_credential_id
        +Boolean granted_reward_credit
        +UUID reward_transaction_id
        +DateTime recognized_at
        +DateTime revoked_at
        +String revocation_reason
        +String request_idempotency_key
    }
    class CoreVerified {
        <<RecognitionClass>>
        Mastery Thresholds (M6, M8, M10)
        Epic/Boss Quest Clears
        Durable Artifact Production
        Completed Season Arcs
    }
    class UserConfirmedRealWorld {
        <<RecognitionClass>>
        Marathon Completion
        Book / Research Publication
        Job Promotion / Career Pivot
        Public Speaking / Conference
    }
    Milestone <|-- CoreVerified
    Milestone <|-- UserConfirmedRealWorld
```

### 2.1 `CORE_VERIFIED`
Milestones whose prerequisites are completely and deterministically validated by existing Growth Core tables:
- **Mastery Threshold**: Achieving advanced Mastery levels (e.g. M6 Independent, M8 Systemize, M10 Create) in a recognized Skill backed by verified Evidence in the Core Growth Engine.
- **Epic/Boss Quest Victory**: Successful completion of a high-order Quest (`quest.status = 'completed' AND (quest.quest_size IN ('epic', 'main') OR quest.is_boss = true)`).
- **Durable Artifact Production**: Authoring a verified durable Artifact (e.g., open-source library, published essay, comprehensive architecture blueprint).
- **Season Arc Completion**: Successfully completing an active Season with a user-confirmed Final Review.

### 2.2 `USER_CONFIRMED_REAL_WORLD`
Milestones recognizing external, offline accomplishments that exceed the typical boundary of daily digital logging:
- Running a marathon or achieving a significant fitness standard.
- Securing a career promotion or launching an independent business.
- Delivering a keynote speech or passing a professional accreditation exam.
- **Validation Requirement**: User self-attestation with optional descriptive context or external links, confirmed via explicit modal review.
- **Recognition vs. Reward Eligibility**: `USER_CONFIRMED_REAL_WORLD` serves as an honorable recognition record. However, **self-attestation alone does NOT automatically mint reward credits**. Only real-world milestones that satisfy explicit deterministic policy backed by verifiable independent external evidence (e.g., accredited certification, credential ID, public race timing link, published paper DOI) may mint credits. Unverified self-claims mint 0 credits.

---

## 3. Explicitly Forbidden Vanity Metrics

The system will reject any milestone definition based on the following anti-patterns:
- Daily or weekly login streaks (e.g., "7-Day Streak Warrior").
- Raw app time or screen time accumulation.
- Number of clicks, taps, or UI navigation events.
- Micro-task quantity counts (e.g., "Completed 50 quick tasks").
- Social vanity metrics (e.g., "Invited 3 friends").

---

## 4. De-duplication and Reward Economy Linkage

Milestones serve as one of the four sparse, high-value source classes authorized to mint Reward Credits in Phase 8E.

### 4.1 Anti-Double-Minting: Core Source Anchoring
To prevent wrapper double-minting, when a `CORE_VERIFIED` Milestone wraps a Quest, Skill Mastery, or Artifact that already minted credits:
$$\text{canonical\_source\_identity} = (\text{user\_id}, \text{underlying\_core\_source\_type}, \text{underlying\_core\_source\_id}, \text{policy\_version}, \text{'EARN'})$$
- The canonical reward source identity anchors directly to the underlying Core source entity (`canonical_source_type = 'QUEST'`, `canonical_source_id = quest.id`), **NOT** the `milestone_id`.
- For Skill Mastery milestones, the canonical source identity incorporates the threshold level (`canonical_source_type = 'MASTERY'`, `canonical_source_id = '${skill.id}:M${threshold_level}'`), ensuring M6, M8, and M10 each mint independently once per skill while preventing duplicate minting for the same threshold.
- If the user already earned reward credits for Boss Quest X, the Milestone wrapper cannot mint a second grant because the database unique index on canonical source identity will reject it.
- The milestone record sets `granted_reward_credit = true` and references the resulting transaction.

### 4.2 Revocation and Correction Model (Rule: MILESTONE_REVOCATION_LEDGER_CORRECTION, Harness: O005, O020)
If an underlying prerequisite Activity or Quest is subsequently deleted, invalidated, or flagged as fraudulent:
1. **Atomic Settlement via `rpc_revoke_milestone`**:
   - Acquires exclusive row locks on `milestones` and `reward_accounts`.
   - Transitions `milestones.status` to `REVOKED`, records `revoked_at = clock_timestamp()` and `revocation_reason = p_revocation_reason`.
   - The Milestone record is **never hard-deleted**; personal achievement history is append-/status-preserved.
2. **Ledger Offset via Schema-Backed `CORRECTION`**:
   - If reward credits were previously issued (`granted_reward_credit = true` and `reward_transaction_id IS NOT NULL`), the RPC queries the original transaction and appends an offsetting `CORRECTION` transaction:
     ```sql
     INSERT INTO reward_transactions (
       user_id, event_kind, amount, canonical_source_type, canonical_source_id,
       policy_version, request_idempotency_key, correction_for_id
     ) VALUES (
       auth.uid(), 'CORRECTION', -orig_tx.amount, orig_tx.canonical_source_type,
       orig_tx.canonical_source_id, orig_tx.policy_version,
       p_request_idempotency_key || ':correction', orig_tx.id
     );
     ```
   - Partial unique constraint `uq_reward_tx_correction_for` guarantees that at most ONE correction can ever be applied to the original transaction.
   - Re-folds `reward_accounts` balance using `foldRewardLedger`. If available credits drop below 0, records an auditable `correction_deficit` without historical loss.
3. **Immutable Audit Provenance**:
   - Appends audit event to `outer_loop_audit_events` with `action = 'MILESTONE_REVOKED'`.

### 4.3 Schema & Idempotency Governance Contract
- **Unique Source Constraint**: `UNIQUE (user_id, milestone_key, source_type, source_id)` ensures that duplicate recognition cannot be created for the same source event.
- **Durable Client Idempotency**: `UNIQUE (user_id, request_idempotency_key)` protects both confirmation and revocation RPCs from network replay duplicate side effects.
- **Write Authority**: Strictly RPC-only (`rpc_confirm_milestone`, `rpc_settle_milestone_reward`, `rpc_revoke_milestone`). Client direct writes are denied via RLS.

---

## 5. AI Game Master Contract for Milestones

- **Milestone Candidacy Detection (`MILESTONE_CANDIDATE`)**:
  - The AI GM monitors completed Season Reviews and durable Artifact submissions.
  - When it detects that a user's recent achievements satisfy an unawarded milestone rubric, it formats an `OuterLoopProposal`.
  - The proposal highlights the evidence: *"Based on your successful deployment of the production database migration in Quest #42 and your M6 Independent verification, you are eligible for the 'Database Architect' Milestone."*
- **No Direct Award Authority (O8)**:
  - The AI GM can never directly award a milestone.
  - The user reviews the candidate proposal and confirms the recognition.

---

## 6. Verification & Deterministic Test Scenarios

- **O012_MILESTONES_PRIORITIZE_REAL_GROWTH**: Automated test asserts that all seeded and candidate milestones evaluate against Mastery, Quests, Artifacts, or Real-World criteria; attempts to create a milestone with `source_type = 'LOGIN_STREAK'` fail schema validation.
- **O021_MILESTONE_AI_PROPOSAL_CONFIRMATION**: AI candidacy proposal remains in `PROPOSED` state until an authenticated user RPC accepts it.
- **O005_REWARD_REVERSAL_IS_CORRECTION**: Triggering milestone revocation appends an auditable negative ledger entry without hard-deleting the milestone record.
