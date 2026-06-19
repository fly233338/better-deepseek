# Development Checklist

## DeepSeek-linked dark appearance

- Status: Implemented.
- Summary: Better DeepSeek now follows the DeepSeek web app's current light or dark appearance. The sidebar folder UI, prompt library drawer, source browsing view, variable form, and all custom modals receive the same theme class.
- Key files:
  - `src/content/theme.ts`
  - `src/content/index.ts`
  - `src/content/promptPanel.ts`
  - `src/content/styles.css`
  - `src/content/theme.test.ts`
- Validation:
  - `npm run typecheck`
  - `npm test`
  - `npm run build`
- Manual checks:
  - Verify DeepSeek light mode keeps the existing light visual style.
  - Verify DeepSeek dark mode uses dark surfaces, readable text, visible borders, and clear hover/selected states.
  - Switch DeepSeek appearance while the page is open and confirm Better DeepSeek updates without refresh.
  - Check folder colors, selected conversations, drag targets, multi-select toolbar, prompt source view, and variable/custom dialog surfaces.
