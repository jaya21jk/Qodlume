# Qodlume

Qodlume is a static Next.js daily quiz app that keeps quiz content in external JSON files instead of embedding questions in page components or app logic.

## Content source model

The Phase 1 architecture supports three data-source layers:

1. Local file-based content under `content/quizzes/*.json`
2. Owner-side upload validation in the browser for a preview-only import workflow
3. Future API-backed repository behind a shared `QuizRepository` interface

The application uses the file-based repository during static builds. This keeps the site compatible with Cloudflare Pages and other static hosting providers.

## Static publishing workflow

1. Create or update a quiz JSON file in `content/quizzes/`.
2. Run `node --import tsx ./scripts/validate-quizzes.ts` to validate the manifest and content.
3. Review the exported draft or validated package in the admin import studio.
4. Download the validated JSON package if needed.
5. Commit the file to GitHub and deploy the static site.
6. Only published content is visible to public visitors.

> Browser uploads are never persisted on static hosting. A local preview can be validated, but the actual live content updates only after a new build is deployed from GitHub.

## Publication state model

- `draft`: in-progress content that is excluded from public pages.
- `validated`: schema and business rules accepted, but not yet published.
- `published`: visible to visitors and included in the archive.
- `archived`: retained historical version; preserved for auditing and previous challenge references.

## Validation

Run the validator with:

```bash
node --import tsx ./scripts/validate-quizzes.ts
```

The build is guarded by `prebuild` and will fail if the published quiz content is invalid.

## Future backend integration

The future Spring Boot + PostgreSQL workflow is documented in `src/types/api-contract.ts` and is intentionally isolated behind the repository abstraction so the UI does not depend on database table structures.
