import { Component, type ComponentType, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  resolveTokens,
  tokenCssVar,
  type ComponentManifest,
  type DesignTokens,
  type ResolvedToken,
} from "@cogitato/contract/browser";
import { generateDemos } from "./demos.js";

/** Everything /__kit shows. The Vite plugin's `virtual:kit/kit` module builds it. */
export interface KitData {
  tokens: DesignTokens;
  manifests: ComponentManifest[];
  /** Kit components by name, from the workspace's kit/<Name>.tsx. */
  components: Record<string, ComponentType<Record<string, unknown>>>;
  /** Hand-written demos by component name, from the workspace's kit/<Name>.demo.tsx. */
  demos: Record<string, ComponentType>;
}

class DemoBoundary extends Component<{ children: ReactNode }, { error?: string }> {
  state: { error?: string } = {};
  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
  render() {
    return this.state.error ? <div className="kit-ui-error">Couldn't show this: {this.state.error}</div> : this.props.children;
  }
}

function describe(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(describe).join(", ");
  if (value && typeof value === "object" && "value" in value && "unit" in value) {
    const v = value as { value: number; unit: string };
    return `${v.value}${v.unit}`;
  }
  return JSON.stringify(value);
}

function group(tokens: ResolvedToken[], type: string, prefix?: string) {
  return tokens.filter((t) => t.type === type && (!prefix || t.path.startsWith(prefix)));
}

function TokenSections({ tokens }: { tokens: DesignTokens }) {
  const all = resolveTokens(tokens);
  const colors = group(all, "color");
  const dimensions = group(all, "dimension");
  const typography = group(all, "typography");
  const shadows = group(all, "shadow");
  return (
    <>
      <h2>Colors</h2>
      <div className="kit-ui-grid">
        {colors.map((t) => (
          <div className="kit-ui-swatch" key={t.path}>
            <div className="kit-ui-swatch-color" style={{ background: `var(${tokenCssVar(t.path)})` }} />
            <div className="kit-ui-swatch-meta">
              <div className="kit-ui-code">{t.path}</div>
              <div className="kit-ui-muted">
                {describe(t.resolved)}
                {t.aliasOf ? ` (= ${t.aliasOf})` : ""}
              </div>
              {t.description && <div>{t.description}</div>}
            </div>
          </div>
        ))}
      </div>

      <h2>Typography</h2>
      {typography.map((t) => (
        <div className="kit-ui-scale" key={t.path}>
          <span className="kit-ui-scale-name kit-ui-code">{t.path}</span>
          <span style={{ font: `var(${tokenCssVar(t.path)})`, letterSpacing: `var(${tokenCssVar(t.path)}-letter-spacing, normal)` }}>
            The quick brown fox pays now
          </span>
        </div>
      ))}

      <h2>Sizes</h2>
      {dimensions.map((t) => (
        <div className="kit-ui-scale" key={t.path}>
          <span className="kit-ui-scale-name kit-ui-code">{t.path}</span>
          {t.path.startsWith("radius") ? (
            <span style={{ width: 48, height: 32, background: "#dbeafe", borderRadius: `var(${tokenCssVar(t.path)})` }} />
          ) : (
            <span style={{ height: 12, background: "#93c5fd", width: `var(${tokenCssVar(t.path)})`, minWidth: 1 }} />
          )}
          <span className="kit-ui-muted">{describe(t.resolved)}</span>
        </div>
      ))}

      {shadows.length > 0 && <h2>Shadows</h2>}
      <div className="kit-ui-grid">
        {shadows.map((t) => (
          <div key={t.path} className="kit-ui-demo" style={{ boxShadow: `var(${tokenCssVar(t.path)})`, border: 0 }}>
            <span className="kit-ui-code">{t.path}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function ComponentCard({ manifest, kit }: { manifest: ComponentManifest; kit: KitData }) {
  const Impl = kit.components[manifest.name];
  const CustomDemo = kit.demos[manifest.name];
  return (
    <section className="kit-ui-card" id={`component-${manifest.name}`}>
      <div className="kit-ui-card-head">
        <h3>{manifest.name}</h3>
        <span className={`kit-ui-badge kit-ui-badge-${manifest.source}`}>from {manifest.source}</span>
        <span className={`kit-ui-badge kit-ui-badge-${manifest.confidence}`}>{manifest.confidence} confidence</span>
        <span className="kit-ui-code kit-ui-muted">{manifest.import}</span>
      </div>
      {manifest.description && <p>{manifest.description}</p>}

      <table className="kit-ui-table">
        <thead>
          <tr>
            <th>Prop</th>
            <th>Type</th>
            <th>Default</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(manifest.props).map(([name, def]) =>
            def ? (
              <tr key={name}>
                <td className="kit-ui-code">
                  {name}
                  {def.required ? " *" : ""}
                </td>
                <td>{def.type === "enum" ? def.values.join(" | ") : def.type}</td>
                <td>{"default" in def && def.default !== undefined ? String(def.default) : ""}</td>
              </tr>
            ) : null,
          )}
        </tbody>
      </table>
      <div className="kit-ui-muted">States: {manifest.states.join(", ")}</div>
      {manifest.rules && manifest.rules.length > 0 && (
        <ul>
          {manifest.rules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}

      {!Impl && !CustomDemo ? (
        <p className="kit-ui-error">Not built yet: there's no kit/{manifest.name}.tsx in the workspace yet.</p>
      ) : CustomDemo ? (
        <DemoBoundary>
          <CustomDemo />
        </DemoBoundary>
      ) : (
        Impl &&
        generateDemos(manifest).map((g) => (
          <div className="kit-ui-demo-row" key={g.title}>
            <div className="kit-ui-muted">{g.title}</div>
            <div className="kit-ui-demos">
              {g.demos.map((d) => (
                <div className="kit-ui-demo" key={d.label}>
                  <div className="kit-ui-demo-label kit-ui-code">{d.label}</div>
                  <DemoBoundary>
                    <Impl {...d.props} />
                  </DemoBoundary>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </section>
  );
}

/** The /__kit page: every token and component in the contract, with live demos. */
export function KitPreview({ kit }: { kit?: KitData }) {
  if (!kit) {
    return (
      <div className="kit-ui kit-ui-notice">
        <h3>The kit page isn't set up.</h3>
        <p>Pass the kit from "virtual:kit/kit" to mountPrototype.</p>
      </div>
    );
  }
  const manifests = [...kit.manifests].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="kit-ui kit-ui-page">
      <h1>Design kit</h1>
      <p className="kit-ui-muted">
        Everything prototypes can use. <Link to="/">Back to screens</Link>
      </p>
      <h2>Components</h2>
      {manifests.map((m) => (
        <ComponentCard key={m.name} manifest={m} kit={kit} />
      ))}
      <TokenSections tokens={kit.tokens} />
    </div>
  );
}
