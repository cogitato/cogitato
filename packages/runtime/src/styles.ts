// Styles for Cogitato's own UI (dev chrome, /__kit, helper pages). Not prototype code, so not
// held to the token rules; everything is prefixed `kit-ui-` to stay out of the prototype's way.
export const UI_CSS = `
.kit-ui { font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; color: #1f2937; }
.kit-ui a { color: #2563eb; }
.kit-ui-page { max-width: 1080px; margin: 0 auto; padding: 32px 20px 80px; }
.kit-ui-page h1 { font-size: 24px; margin: 0 0 4px; }
.kit-ui-page h2 { font-size: 18px; margin: 40px 0 12px; }
.kit-ui-page h3 { font-size: 15px; margin: 0; }
.kit-ui-muted { color: #6b7280; }
.kit-ui-notice { margin: 48px auto; max-width: 520px; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background: #fff; }
.kit-ui-notice ul { padding-left: 18px; }
.kit-ui-chrome { position: fixed; right: 12px; bottom: 12px; z-index: 2147483000; display: flex; gap: 6px; align-items: center;
  padding: 6px 8px; border-radius: 10px; background: rgba(17,24,39,.92); color: #f9fafb; box-shadow: 0 4px 16px rgba(0,0,0,.25); }
.kit-ui-chrome select { font: inherit; font-size: 12px; max-width: 200px; border-radius: 6px; border: 0; padding: 3px 4px; }
.kit-ui-chrome a, .kit-ui-chrome button { color: #f9fafb; font-size: 12px; background: none; border: 0; cursor: pointer; text-decoration: underline; }
.kit-ui-chrome-label { font-size: 11px; opacity: .7; }
.kit-ui-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
.kit-ui-swatch { border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; background: #fff; }
.kit-ui-swatch-color { height: 56px; }
.kit-ui-swatch-meta { padding: 6px 8px; font-size: 12px; }
.kit-ui-code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
.kit-ui-scale { display: flex; align-items: center; gap: 12px; margin: 6px 0; }
.kit-ui-scale-name { width: 160px; }
.kit-ui-card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin: 16px 0; background: #fff; }
.kit-ui-card-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.kit-ui-badge { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: #f3f4f6; color: #374151; }
.kit-ui-badge-production, .kit-ui-badge-high { background: #dcfce7; color: #166534; }
.kit-ui-badge-figma, .kit-ui-badge-medium { background: #fef9c3; color: #854d0e; }
.kit-ui-badge-generated, .kit-ui-badge-low { background: #fee2e2; color: #991b1b; }
.kit-ui-table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 13px; }
.kit-ui-table th, .kit-ui-table td { text-align: left; border-bottom: 1px solid #f3f4f6; padding: 4px 8px 4px 0; vertical-align: top; }
.kit-ui-demos { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 8px; }
.kit-ui-demo { border: 1px dashed #e5e7eb; border-radius: 8px; padding: 12px; min-width: 120px; }
.kit-ui-demo-label { font-size: 11px; color: #6b7280; margin-bottom: 8px; }
.kit-ui-demo-row { margin-top: 12px; }
.kit-ui-error { color: #991b1b; font-size: 12px; }
`;
