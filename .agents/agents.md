# Antigravity Agent Routing & Execution Specification — MerkadoGo Web

This document defines the mandatory execution behaviors, routing heuristics, startup protocols, and skill lifecycle policies for all Antigravity / Gemini agents operating within the **MerkadoGo Web** workspace.

---

## 🚨 0. MANDATORY SESSION STARTUP PROTOCOL (STRICTLY ENFORCED)

At the **START of EVERY session and before taking any action or writing code**, the agent MUST execute the following pre-flight checks:

### 0.1 Strict Master Prompt & Context Ingestion
1. **Read Master Prompt**: Explicitly read and internalize [`MASTER_PROMPT.md`](file:///d:/Projects/MerkadoGO%20Map/MASTER_PROMPT.md) in the project root.
2. **Read Master Architecture Context**: Read and adhere strictly to [`documents/MerkadoGo_WebApp_Master_Context.md`](file:///d:/Projects/MerkadoGO%20Map/documents/MerkadoGo_WebApp_Master_Context.md) (ISO/IEC 25010:2023 standard).
3. **Read Dev Vault Second Brain**: Consult the central knowledge suite at [`d:/Projects/Dev Vault/02 - Projects/MerkadoGo/MerkadoGo MOC.md`](file:///d:/Projects/Dev%20Vault/02%20-%20Projects/MerkadoGo/MerkadoGo%20MOC.md).

### 0.2 Architectural Scope Reality
- **Target Application**: Browser-native Web Application (Vanilla HTML/CSS/JS or lightweight bundler, inline DOM SVG floorplan, pure JS A* indoor pathfinding, multilingual search engine, read-only Firebase vendor stream).
- **Design Reference**: The Flutter repository at `d:/Projects/MerkadoGo/` is **strictly a reference library** to copy flat UI/UX design tokens (`AppColors`, `AppTextStyles`, `AppSpacing`), card layouts, and stall detail sheets.
- **Explicitly Dropped / Out of Scope**: Live GPS tracking (replaced by 14 entrance gates), Flutter Web / `<canvas>` rendering, Gemini Chatbot (Android only), Admin & Auth modules (Android only).

### 0.3 Non-Negotiable Execution Guardrails
1. **Step-by-Step Progression**: Execute strictly phase-by-phase following the implementation plan.
2. **No Phase Skipping**: Never jump ahead to future milestones.
3. **No Code Bundling**: Never bundle multiple components, features, or architectural layers in a single output.
4. **Gated Approvals**: Do NOT generate code for subsequent phases until the current step is completely functional, verified, and explicitly approved by the user.
5. **Strict Planning**: The agent MUST strictly invoke and utilize the `planning-and-task-breakdown` and `planning-with-files` skills when creating detailed implementation plans or defining project architecture.
6. **Strict Git Push Restrictions**: The agent must **NEVER execute `git push`** autonomously or without explicit user directive. All git pushes require direct, manual user invocation.
7. **Strict `.gitignore` & Context Exclusion Rule**: The `.gitignore` file itself must **NEVER be committed or pushed** to the remote GitHub repository. Local git exclusions must be mirrored in `.git/info/exclude`. Workspace context files such as `PRODUCT.md` (Impeccable draft), `.env`, `node_modules/`, and `dist/` must strictly remain excluded and untracked.

---

## 1. Skill Discovery Protocol (Pre-Execution Scanning)

### 1.1 Trigger Conditions
The agent MUST immediately initiate a local skill discovery scan when ANY of the following conditions are met:
1. The user's prompt explicitly mentions the word `"skill"` or references a specific skill identifier.
2. The user request involves a concrete workspace engineering task (e.g., SVG manipulation, DOM rendering, A* pathfinding, CSS styling, React/JS architecture, API security, or planning).
3. The requested task can be fulfilled or augmented by any skill bundle present in `.agents/skills/`.

### 1.2 Scanning Order & Priority
- **Primary Source of Truth**: Scan the local project directory [`.agents/skills/`](file:///d:/Projects/MerkadoGO%20Map/.agents/skills) first before consulting global configurations (`~/.gemini/config/skills/`) or relying on generic model knowledge.
- If a skill matching the user's intent or task domain exists in `.agents/skills/`, the agent **must prioritize that local skill over all generic knowledge**.

---

## 2. Deep Reading & Context Ingestion

### 2.1 Mandatory `SKILL.md` Ingestion
- When a matching skill is identified, the agent **MUST NOT** proceed based on memory, pre-trained weights, or assumptions.
- The agent **MUST explicitly read and parse** the full contents of `file://<workspace_root>/.agents/skills/<skill-name>/SKILL.md` (along with any relevant files in `references/`, `scripts/`, or `resources/`) using file viewing tools before constructing a plan or generating code.

### 2.2 Strict Zero-Assumption Rule
- The instructions, constraints, and methodologies detailed inside `SKILL.md` take strict precedence over standard LLM training data.
- The agent must adhere to the exact patterns, architectural layers, and naming conventions defined in the skill documentation.

---

## 3. Strict Execution Lifecycle & Tool Overrides

### 3.1 Custom Skill Precedence Over Default Shell/Tooling
- If a skill specifies atomic scripts, exact command structures, or specialized execution workflows:
  - **The agent must execute the actions exactly as specified in the skill file.**
  - **Default shell assumptions and arbitrary ad-hoc scripts are completely bypassed.**

### 3.2 Standard Lifecycle Execution Stages
For every skill-governed task, the agent must proceed through the following non-negotiable stages:
1. **Discovery & Match**: Identify the target skill in `.agents/skills/`.
2. **Deep Parse**: Read `SKILL.md` and related reference materials.
3. **Plan / Alignment**: Formulate the execution steps matching the skill's explicit workflow.
4. **Deterministic Execution**: Execute commands and code changes strictly adhering to the skill's guidelines.
5. **Verification & Diagnostics**: Execute the verification, testing, or linting steps mapped out in the skill to confirm resolution.

---

## 4. Installed Workspace Skills Matrix

The following local skill bundles in `.agents/skills/` are registered for active routing:

| Skill Identifier | Scope / Purpose | Root Path |
| :--- | :--- | :--- |
| **`impeccable`** | Token-driven UI/UX design rules, flat styling constraints, high-contrast civic design | [`.agents/skills/impeccable/`](file:///d:/Projects/MerkadoGO%20Map/.agents/skills/impeccable) |
| **`web-design-guidelines`** | Web typography, responsive layout, CSS best practices, accessibility (WCAG AA) | [`.agents/skills/web-design-guidelines/`](file:///d:/Projects/MerkadoGO%20Map/.agents/skills/web-design-guidelines) |
| **`vercel-react-best-practices`** | React performance, state architecture, component composition, bundle optimization | [`.agents/skills/vercel-react-best-practices/`](file:///d:/Projects/MerkadoGO%20Map/.agents/skills/vercel-react-best-practices) |
| **`api-security-best-practices`** | API key protection, CORS policies, secure data transport, input validation | [`.agents/skills/api-security-best-practices/`](file:///d:/Projects/MerkadoGO%20Map/.agents/skills/api-security-best-practices) |
| **`security-and-hardening`** | Web application security hardening, defensive coding, XSS & prototype pollution prevention | [`.agents/skills/security-and-hardening/`](file:///d:/Projects/MerkadoGO%20Map/.agents/skills/security-and-hardening) |
| **`planning-and-task-breakdown`** | Milestone decomposition, phase planning, and atomic task structuring | [`.agents/skills/planning-and-task-breakdown/`](file:///d:/Projects/MerkadoGO%20Map/.agents/skills/planning-and-task-breakdown) |
| **`planning-with-files`** | File-based persistent planning, progress tracking, and gated verification | [`.agents/skills/planning-with-files/`](file:///d:/Projects/MerkadoGO%20Map/.agents/skills/planning-with-files) |
| **`brainstorming`** | Design exploration, intent clarification, requirement discovery before code | [`.agents/skills/brainstorming/`](file:///d:/Projects/MerkadoGO%20Map/.agents/skills/brainstorming) |
| **`using-superpowers`** | Skill discovery and orchestration protocol enforcement | [`.agents/skills/using-superpowers/`](file:///d:/Projects/MerkadoGO%20Map/.agents/skills/using-superpowers) |
| **`create-readme`** | Developer handoff and technical documentation generation | [`.agents/skills/create-readme/`](file:///d:/Projects/MerkadoGO%20Map/.agents/skills/create-readme) |

---

## 5. Dev Vault Second Brain Backlinks
- 🛒 **Project Knowledge Suite**: [`d:/Projects/Dev Vault/02 - Projects/MerkadoGo/MerkadoGo MOC.md`](file:///d:/Projects/Dev%20Vault/02%20-%20Projects/MerkadoGo/MerkadoGo%20MOC.md)
- 🛠️ **Tech Stack**: [`d:/Projects/Dev Vault/02 - Projects/MerkadoGo/Tech Stack & Architecture.md`](file:///d:/Projects/Dev%20Vault/02%20-%20Projects/MerkadoGo/Tech%20Stack%20&%20Architecture.md)
- 🎨 **Design System**: [`d:/Projects/Dev Vault/02 - Projects/MerkadoGo/UI-UX Design System.md`](file:///d:/Projects/Dev%20Vault/02%20-%20Projects/MerkadoGo/UI-UX%20Design%20System.md)
- 🛡️ **Rules & Guardrails**: [`d:/Projects/Dev Vault/02 - Projects/MerkadoGo/Project Rules & Guardrails.md`](file:///d:/Projects/Dev%20Vault/02%20-%20Projects/MerkadoGo/Project%20Rules%20&%20Guardrails.md)
