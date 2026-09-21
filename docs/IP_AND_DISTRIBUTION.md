# Intellectual property and distribution strategy

This file records product intent and technical evidence preparation. It is not a substitute for advice from a Colombian intellectual-property attorney or patent agent.

## Objective

The project owner intends to:

- commercially exploit Desweb CMMS;
- preserve evidence of authorship and development history;
- protect the Desweb/CMMS brand;
- evaluate whether any genuinely technical inventions inside the product are patentable;
- distribute the system both as hosted SaaS and as an installable/self-hosted package.

## Separate the protection mechanisms

"Patent the project" should not be treated as one single legal action.

### 1. Software copyright

The source code, documentation and other original software expression are candidates for copyright protection.

Repository practices that help preserve evidence:

- Git history with dated commits;
- pull requests;
- immutable SQL migrations;
- changelog entries;
- architecture and product decisions;
- tagged releases;
- authorship/assignment agreements for human contributors.

Before a formal software registration, produce a clean versioned release and archive the exact source/documentation submitted.

### 2. Trademark

The commercial names and logos (for example **Desweb** and possibly **Desweb CMMS**) should be evaluated independently as trademarks.

Before filing, perform a trademark-availability search and decide the appropriate Nice classes with professional advice.

### 3. Patents / computer-implemented inventions

Do not assume that the CMMS application as a whole is patentable.

A patent evaluation should focus only on a specific technical invention that is novel, inventive and produces a technical effect—not on ordinary CRUD workflows, business rules, subscription logic, UI layouts or the source code itself.

If the project later develops a distinctive technical mechanism (for example novel equipment diagnostics, sensor processing, predictive maintenance algorithms with a technical effect, industrial control, or an unusual computer/network mechanism), document it **before public disclosure** and obtain professional patentability advice.

## Confidential invention record

For each potentially patentable technical development, create a private invention disclosure containing:

- problem being solved;
- prior approaches known to the team;
- technical architecture;
- algorithm/process diagrams;
- why the solution differs technically;
- experimental results;
- dates and inventors;
- commit/tag references;
- public disclosures already made.

Do not put confidential patent claims or unpublished inventive detail in public marketing material before legal review.

## Repository evidence policy

For important milestones:

1. update documentation;
2. merge through a PR;
3. tag a release;
4. archive the release artifact;
5. retain database migration history;
6. retain design/architecture decisions.

Never rewrite already-applied migrations or force-push historical commercial releases unless there is a compelling security reason.

## Licensing / downloadable edition

No open-source license should be added by default.

Before distributing a downloadable commercial edition, define:

- end-user/software license terms;
- number of authorized installations;
- update/support rights;
- whether source code is delivered;
- restrictions on resale/redistribution;
- white-label rights;
- telemetry/privacy terms, if any;
- activation/license-key behavior, if introduced.

The first technical distribution format is Docker Compose. This keeps the same production architecture and avoids creating a separate desktop codebase.
