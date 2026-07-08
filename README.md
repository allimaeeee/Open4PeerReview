# Open4PeerReview


**RUN DEMO**

npm run dev


**BUILDING THE BROWSER EXTENSION**

To build and zip the extension for distribution:

npm run package:ext

This produces `extension/dist.zip`. It is not committed to the repo — it's regenerated fresh each time, so always run the command yourself rather than looking for a pre-built zip in git history. Share the resulting `extension/dist.zip` directly (e.g. via Slack) with anyone who needs to install it.

For local development/testing without packaging:

npm run build:ext

Then load `extension/dist/` as an unpacked extension via `chrome://extensions` (Developer Mode → "Load unpacked").



**COMMIT TO GIT**

git add .

git commit -m ''

git push origin testing


**DIRECTORY**
```markdown
. 📂 Open4PeerReview
├── 📄 AGENTS.md
├── 📄 CLAUDE.md
├── 📄 README.md
└── 📂 app/
│  └── 📂 auth/
│    └── 📂 callback/
│      ├── 📄 route.ts
│  └── 📂 dashboard/
│    └── 📂 components/
│      ├── 📄 AuthorDashboard.tsx
│      ├── 📄 AuthorDashboardClient.tsx
│      ├── 📄 CoordinatorDashboard.tsx
│      ├── 📄 ReviewerDashboard.tsx
│      ├── 📄 RoleToggle.tsx
│      ├── 📄 UploadDocumentForm.tsx
│    └── 📂 feedback/
│      └── 📂 [documentId]/
│        ├── 📄 FeedbackView.tsx
│        ├── 📄 page.tsx
│    ├── 📄 page.tsx
│    └── 📂 settings/
│      ├── 📄 SettingsForm.tsx
│      ├── 📄 page.tsx
│  ├── 📄 favicon.ico
│  ├── 📄 globals.css
│  ├── 📄 layout.tsx
│  └── 📂 login/
│    ├── 📄 page.tsx
│  └── 📂 onboard/
│    ├── 📄 OnboardingForm.tsx
│    ├── 📄 page.tsx
│  ├── 📄 page.tsx
│  └── 📂 review/
│    └── 📂 components/
│      ├── 📄 AnnotationPanel.tsx
│      ├── 📄 PDFViewer.tsx
│      ├── 📄 PDFViewerCanvas.tsx
│      ├── 📄 ReviewerApp.tsx
│      ├── 📄 ReviewerConsole.tsx
│      ├── 📄 SubmitButton.tsx
│    ├── 📄 page.tsx
│  ├── 📄 page.tsx
└── 📂 components/
│  ├── 📄 Navbar.tsx
│  ├── 📄 SaveStatusIndicator.tsx
│  └── 📂 auth/
│    ├── 📄 ProfileForm.tsx
│    ├── 📄 SignupForm.tsx
│  └── 📂 document/
│  └── 📂 ui/
├── 📄 eslint.config.mjs
└── 📂 hooks/
│  ├── 📄 useReviewAutoSave.ts
└── 📂 lib/
│  └── 📂 supabase/
│    ├── 📄 client.ts
│    ├── 📄 index.ts
│    ├── 📄 queries.ts
│    ├── 📄 server.ts
│    ├── 📄 types.ts
│    ├── 📄 useUser.ts
├── 📄 next.config.ts
├── 📄 package-lock.json
├── 📄 package.json
├── 📄 postcss.config.mjs
├── 📄 proxy.ts
└── 📂 public/
│  ├── 📄 file.svg
│  ├── 📄 globe.svg
│  ├── 📄 next.svg
│  ├── 📄 vercel.svg
│  ├── 📄 window.svg
├── 📄 tsconfig.json
└── 📂 types/
│  ├── 📄 database.types.ts
│  └── 📄 index.ts
```
