# Azure — cost-control gate (do not provision until this is verified)

This project targets a small, honest Azure footprint for academic evidence only.

Before provisioning any Azure resources, complete the checklist below and confirm it in the Azure portal.

## What the free offer actually is

The Azure SQL Database free tier is a **free-tier database configuration**, not automatic free usage just because you have a subscription.

Per Microsoft’s current guidance, each free-tier database gets:

- 100,000 vCore-seconds of compute per calendar month
- 32 GB of data storage per month
- 32 GB of backup storage per month
- unused compute does **not** roll over to the next month
- up to 10 free-tier databases per subscription
- the allowance renews for the lifetime of the subscription, subject to those limits

To create one via CLI, Microsoft says to use `--use-free-limit true`. Without that, you create a regular billable serverless database.

In the portal/CLI, the key choice when you create a free-tier database is what happens at the monthly free limit:

- **AutoPause:** when the monthly free limit is reached, the database pauses and is inaccessible until the allowance resets at the start of the next calendar month. Microsoft describes this as stopping charges at the free limit.
- **BillOverUsage / “Continue using database for additional charges”:** the database stays online and usage beyond the free limit is billed at standard General Purpose serverless rates. This is an explicit opt-in to paid overage behavior.

A free-tier database also auto-pauses after **15 minutes of inactivity**, regardless of the monthly free-limit setting. Idle open connections, including query-tool connections, can prevent that idle pause and consume vCore-seconds. Microsoft recommends tracking the **Free amount remaining** metric.

## Non-negotiable checks

- [ ] Confirm the actual subscription offer in the Azure portal / Education Hub.
  - Confirm whether this is the student offer you expect, not a different student variant or a standard free account.
  - **Do not assume “student account” automatically means the Azure SQL free tier is available.**
  - Microsoft says the free tier works with most Azure subscription types, but **Azure for Students Starter is not supported**.
  - If your account is Azure for Students Starter, do not assume the free tier is available; verify the actual subscription type first.
  - Microsoft alternatives mentioned for this case are Azure for College Students or the Azure Free offer, depending on the actual account.
- [ ] Confirm whether the Azure SQL Database free tier is available for **this specific subscription**.
  - If it is available, create the Azure SQL Database as the **free-tier option**.
  - If it is not available for the subscription you have, do **not** create Azure SQL and use the fallback in `docs/azure-fallback.md`.
- [ ] The database must be new. An existing database cannot be converted or restored into the free tier.
- [ ] If the free tier is used, choose **AutoPause** at the free limit, not BillOverUsage.
  - BillOverUsage is billed beyond the free limit and is effectively an opt-in to paid usage.
  - Once the wrong behavior is chosen, do not assume you can silently undo it; re-verify the configuration in the portal.
- [ ] Estimate Blob costs in your actual region before creating the storage account.
  - Planned config: one Standard general-purpose v2 storage account, LRS, Hot tier, one private container, tiny files, minimal operations.
  - Blob pricing depends on storage capacity, transactions, redundancy, access tier, and data transfer behavior.
  - “Private” is an access setting, not a free-storage feature.
  - Use the Microsoft pricing calculator for your region; do not rely on generic example numbers.
- [ ] Check whether existing resources or remaining credit would already consume the budget before creating anything new.
- [ ] Decide the under-$1 target is plausible for your actual account/region before provisioning anything.

## Planned Azure footprint

- Azure SQL Database: compatibility runs, test-case results, audit events only.
- Azure Blob Storage: private container for uploaded specs and generated report artifacts.
- No VMs, no App Service, no Azure OpenAI, no paid observability unless a real demonstrated need appears after verification.

## Known billing risks

- Choosing BillOverUsage instead of AutoPause can create charges beyond the free limit.
- Idle connections can prevent the 15-minute inactivity auto-pause and consume vCore-seconds.
- Blob cost depends on region, redundancy, tier, and how often you write/read/list/transfer.
- Budget alerts warn; they are not a hard spending cap.

## Degradation policy

- If Azure Blob is not configured or fails, the app must continue to work in a clearly visible “Azure not configured” state and must not claim a live Azure feature works.
- If Azure SQL is not configured or fails, core execution continues, but detailed execution evidence is not persisted. Supabase may retain only app-level run metadata/summary with an explicit evidence-persistence status; never describe that as Azure SQL evidence.

## Secrets handling

- Azure credentials are server-side only.
- See `.env.example` for the exact variable names.
- Never expose Azure credentials to client code or `NEXT_PUBLIC_*` variables.

