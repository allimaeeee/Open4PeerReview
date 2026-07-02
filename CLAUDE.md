# CLAUDE.md — OER Certification Hub (Team Mask'd)

## Project Overview

The OER Certification Hub is a peer review platform for Open Educational Resources (OER), built in partnership with CMU's Open Learning Initiative (OLI) and Maricopa Community Colleges. It replaces a slow, email-based review process with an automated "Certification Hub" using standardized rubrics and digital stamps.

**Repository:** github.com/allimaeeee/AnnotationPlatform
**Prototype (Vercel):** https://oerhub.vercel.app/author
**Status:** Early development — designing components and building the functional MVP
**Program:** METALS Capstone (7-month project, spring + summer 2026)
**Process:** Lean development with iterative Build–Measure–Learn cycles across multiple MVP releases (Discover → Ideate → Release → Rediscover)

### Hunt Statement
Our team, in partnership with Maricopa County Community Colleges and the Open Learning Initiative (OLI), will standardize the evaluation of Open Educational Resources (OER) through the development of a structured peer-review platform integrated with AI-assisted moderation, which empowers content creators to iteratively refine their materials.

---

## User Roles

The platform serves four user types. A single person may hold multiple roles simultaneously (e.g., an author for their own work and a reviewer for someone else's).

- **Author (Sarah):** Submits OER, tracks review progress, receives structured feedback, performs revisions
- **Reviewer (James):** Evaluates OER using a side-by-side workspace with rubric-based annotation tools
- **Coordinator (Mark):** Manages the review pipeline, assigns reviewers, mediates feedback quality
- **Consumer/Adopter (Educator):** Discovers certified OER via validation landing pages and digital stamps

---

## Platform Architecture (Blocks)

- **Block A — Submission & Dashboard:** Author submission flow, reviewer task center, coordinator command center. Statuses: Submitted, Under Review, In Revision, Certified
- **Block B — Integrated Reviewer Console:** Horizontal split-pane workspace. Left: OER content (web proxy or PDF.js). Right: rubric panel with evidence-driven annotation system. Core feature of the platform
- **Block C — Feedback, Reports & Revision:** Aggregated report view, revision cards, author reflection, digital stamp generation, public validation landing page
- **Block D — Progress Management & Persistence:** Auto-save, draft persistence, progress tracking

---

## Figma Files

### Design System
https://www.figma.com/design/Xjl43yYOIUTQ6QA1Q3dVxy/%F0%9F%8E%A8-Design-System?node-id=1-2

### Product Views
Organized by platform block (matching PRD structure):
- **Block A — Submission & Dashboard:** https://www.figma.com/design/VCISA1y1N5ziQt36n84hJV/%E2%9C%8D%EF%B8%8F-Author-View?node-id=0-1
- **Block B — Reviewer Console:** https://www.figma.com/design/Ka66r49YYnJVtF51VPN62H/%F0%9F%94%8D-Reviewer-View?node-id=0-1
- **Block C — Feedback & Revision:** https://www.figma.com/design/OKG2utxwz6zA28MiskYX7D/%F0%9F%8C%90-Consumer-View?node-id=0-1

---

## Design System Rules

### Token Philosophy
- **Never apply primitive tokens directly to UI.** Always use semantic tokens.
- Primitives define the raw palette (Color/Primitive collection). Semantics define usage context (Color/Semantic collection).

### Colors
- Primary brand: Blue (#3D6FA9, blue-500)
- Secondary brand: Terracotta (#C4622D, terracotta-500) — NOTE: secondary brand color is not finalized and may change. Always pull the current value from the Design System Figma file rather than relying on this document.
- Success/feedback: Green (#22C55E)
- Full primitive scales exist for: blue, terracotta, green, neutral, red, amber

### Semantic Color Groups
- Brand (primary, secondary)
- Surface (background, card, elevated)
- Border (default, strong, subtle)
- Text (primary, secondary, disabled, inverse)
- Status (success, warning, error, info)
- Feedback (positive, negative, neutral)
- Interactive (default, hover, active, disabled, focus)

### Typography
- UI text: Inter
- Code: JetBrains Mono
- Scale: display, heading (h1–h4), body (large, default, small), label, caption, code

### Spacing
- Tailwind-compatible naming (values match pixel sizes)
- Defined in spacing token collection

### Border Radius
- radius/none through radius/full (9999px)

### Elevation
- Four-level layered shadow system

---

## Rubric Templates

The platform supports 6 standardized rubric templates. Each is loaded dynamically as JSON based on the reviewer's assigned task:

1. **Accessibility** (8 criteria: text structure, color contrast, alt text, multimedia, interactive elements, tables, links, technical format)
2. **Copy Editing** (10 criteria: grammar, spelling, punctuation, style guide, consistency, clarity, formatting, citations, cross-references, inclusive language)
3. **Copyright** (8 criteria: licensing, third-party content, attribution, fair use, license compatibility, public domain, status communication, permissions)
4. **Disciplinary Appropriateness** (7 criteria: accuracy, currency, completeness, scholarly rigor, college-level appropriateness, source quality, assessment quality)
5. **eLearning Review** (9 criteria: usability, technical support, mobile accessibility, LMS integration, data privacy, cost/sustainability, accessibility integration, pedagogical effectiveness, learning analytics)
6. **Universal Design for Learning** (8 criteria: representation, expression, engagement, expectations/feedback, collaboration, metacognition, equity/bias, OER-specific UDL)

---

## Design-to-Code Workflow

### Primary Workflow (Design in Figma → Code via Claude Code)
The everyday default. Use this for most work.
1. Design components and screens manually in Figma using the design system tokens
2. Use `get_design_context` on Figma frame URLs to pull structured design data
3. Generate code that references real token names and component patterns
4. Iterate in code, capture back to Figma if needed via `generate_figma_design`

### Hybrid Workflow (Scaffold in Figma → Refine → Code)
Use during initial component buildout to save time standing up structures.
1. Use Claude Code + Figma MCP write-to-canvas to scaffold initial component structures (frames, auto layout, token bindings)
2. Refine the scaffolded components visually in Figma
3. Follow the primary workflow from step 2 onward

### Prototype Capture Workflow
One-time use to bring existing Vercel prototype screens into Figma as a starting point.
1. Point `generate_figma_design` at the live Vercel prototype URL
2. Capture screens as editable Figma layers
3. Redesign the captured frames using the design system
4. Generate production code from the polished designs

---

## Code Conventions

### General Rules
- Before writing any UI code, run `get_design_context` on the relevant Figma frame
- Use real token names from the design system — never hardcode color values, spacing, or typography
- When generating components, match existing naming patterns in the codebase
- All components should handle the states defined in the design system: default, hover, focus, disabled, error

### Tech Stack
- **Status:** Not yet decided — this file will be updated when the team selects a framework
- When the stack is chosen, add framework-specific conventions here

### Naming Conventions
- Component files: PascalCase (e.g., `ReviewerConsole.jsx`)
- Utility files: camelCase (e.g., `formatRubric.js`)
- CSS/token references: kebab-case matching Figma token names

---

## Git Workflow

### Branching Strategy: Feature Branches
- `main` is always the stable, working version
- Create feature branches off `main` with descriptive names
- Open a Pull Request to merge back into `main` when ready

### Branch Naming Convention
```
feature/block-a-author-dashboard
feature/block-b-split-pane
feature/block-b-annotation-engine
feature/block-c-revision-cards
fix/rubric-loader-bug
```

### Commit Messages
- Start with a verb: "Add author dashboard layout", "Fix rubric accordion state", "Update spacing tokens"
- Reference the block when relevant: "[Block B] Add evidence bank component"

### Pull Request Guidelines
- Include the Figma frame URL in the PR description
- Describe what changed and why
- Tag relevant teammates for review

---

## Key Technical Concepts

### Reviewer Console (Block B) — The Core Feature
The reviewer console is the most complex piece of the platform. Key technical requirements:
- **Horizontal split-pane:** OER content left, rubric panel right. Supports manual resizing and 7:3 / 5:5 presets
- **Annotation engine:** Contextual menu on text selection. Annotations tagged to specific rubric criteria with anchor coordinates
- **Evidence bank:** Annotations auto-aggregated by criterion. Bi-directional navigation between evidence and source content
- **Single-point rubric UI:** 3-column layout (Needs Improvement | Standard | Exceeds) with independent toggles
- **Auto-save:** Every rating selection and annotation triggers a save. Manual "Save Draft" also available
- **Validation:** 100% criteria completion required. Evidence required for non-standard ratings

### Content Rendering
- Web URLs: Proxy layer with transparent annotation overlay
- PDF files: PDF.js renderer with annotation support
- Both must support text selection for the annotation engine

### Data Integrity
- Annotations stored with unique anchors and criterion_id
- Evidence bank mapped in real-time to annotation database
- Feedback licensed under CC BY-ND (Attribution-NoDerivs)

---

## MCP Servers

This project uses two MCP servers configured in `.mcp.json`:
- **Figma MCP** (https://mcp.figma.com/mcp) — Read design context, write to canvas, manage Code Connect
- **GitHub MCP** (https://api.githubcopilot.com/mcp) — Repository management, issues, PRs, code browsing

Each team member authenticates individually through their local config.

---

## Team

**Team Mask'd** — METALS Capstone project team

| Team Member | Primary Role | Secondary Role |
|---|---|---|
| Dimple Lin | Project Lead | Product |
| Kang Tan | Product Lead | Development |
| Monica Xu | Research Lead | Design |
| Sara Liang | Design Lead | Project |
| Allison Dayton | Development Lead | Research |

Partners: CMU Open Learning Initiative (OLI), Maricopa Community Colleges

---

## Current Project Phase

The project follows a lean Build–Measure–Learn process with iterative MVP releases. The design process moves through: speed dating → journey mapping → low-fi sketches/wireframes → user testing → mid-fi iterations → high-fi refinement → final interactive prototype.

**Current status:** Designing components and preparing for development. Design system foundations (tokens, typography, spacing) are established in Figma. Product views (Author, Reviewer, Consumer) are created but not yet populated with screens.
