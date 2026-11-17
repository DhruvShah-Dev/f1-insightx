<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Repository context

- The active website is the TanStack Start app at the repository root. `apps/web`
  is an archived Next.js app; do not implement new product work there.
- `src/routes` contains active pages, `src/components` contains shared and
  report UI, and `src/lib/f1.functions.ts` is the public server-function boundary.
- `data/` contains offline ingestion, validation, and compact product-view
  builders. Raw OpenF1 and staged downloads are local archives, not browser
  payloads or Git release artifacts. See `data/README.md` for coverage reports.
- Keep small generated files required by static app imports available to CI and
  deployments; a local build can pass while an untracked import fails on GitHub.
- Check `data/season_state.json` and validation reports for current product
  freshness. Dated documents and screenshots are historical snapshots.
- Before shipping web changes, run `npm run lint` and `npm run build`. Validate
  affected data views before publishing them. Preserve the user's uncommitted
  work and do not rewrite Lovable-connected Git history.
