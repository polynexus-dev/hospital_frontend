import { useEffect, useState } from "react"
import { api } from "../../api/client"
import { ResourceTable } from "../../components/resource/ResourceTable"
import { col } from "./fields"

// Single sign-on configuration (NABH DAC.1.e): Microsoft Entra ID, Google
// Workspace or another OpenID Connect provider, per hospital.

function SetupGuide() {
  const [setup, setSetup] = useState<{ redirect_uri: string; scopes: string; password_login: boolean } | null>(null)
  const [copied, setCopied] = useState(false)
  useEffect(() => { api.get<any>("/sso-providers/setup/").then(setSetup).catch(() => setSetup(null)) }, [])
  if (!setup) return null
  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 space-y-3 text-sm">
      <h2 className="text-lg font-bold">Set up single sign-on</h2>
      <ol className="list-decimal pl-5 space-y-1.5 text-slate-600 dark:text-slate-300">
        <li><b>Microsoft 365:</b> Entra ID › App registrations › New registration. Add a <i>Web</i> redirect URI (below), then create a client secret. Copy the Application (client) ID, the secret and the Directory (tenant) ID.</li>
        <li><b>Google Workspace:</b> Google Cloud console › APIs &amp; Services › Credentials › OAuth client ID (Web application). Add the redirect URI below; set the consent screen to <i>Internal</i>.</li>
        <li>Add the provider here with those values and your email domain, then press <b>Test</b>.</li>
        <li>Staff sign in with the button on the login page. Their account must already exist here with the same work email — SSO never creates accounts.</li>
        <li>Optional: turn on <b>Require single sign-on</b> in the Security policy tab. Owner and administrator roles keep password sign-in as a fallback.</li>
      </ol>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-500">Redirect URI</span>
        <code className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-900 text-[12.5px]">{setup.redirect_uri}</code>
        <button className="text-xs font-semibold text-emerald-700" onClick={() => { navigator.clipboard?.writeText(setup.redirect_uri); setCopied(true) }}>{copied ? "Copied" : "Copy"}</button>
        <span className="text-xs text-slate-500">· scopes: {setup.scopes}</span>
      </div>
      {!setup.password_login && <div className="text-xs text-amber-700">Single sign-on is required: staff can't use passwords (owner/admin roles excepted).</div>}
    </section>
  )
}

export function SSOSettings() {
  return (
    <div className="space-y-6">
      <SetupGuide />
      <ResourceTable config={{
        title: "Sign-in providers", endpoint: "/sso-providers/", createLabel: "Add provider", searchable: false,
        columns: [col("display_name", "Button text"), col("kind", "Provider"), col("client_id", "Client ID"),
          { key: "allowed_domains", label: "Domains", render: (r) => (r.allowed_domains?.length ? r.allowed_domains.join(", ") : "Any") },
          { key: "has_secret", label: "Secret", render: (r) => (r.has_secret ? "Stored" : "Missing") }, col("linked_users", "Linked staff"), col("is_enabled", "Enabled")],
        fields: [
          { key: "kind", label: "Provider", type: "select", required: true, options: [
            { value: "microsoft", label: "Microsoft Entra ID (Microsoft 365)" }, { value: "google", label: "Google Workspace" }, { value: "oidc", label: "Other OpenID Connect provider" }] },
          { key: "display_name", label: "Button text", required: true, placeholder: "e.g. Hospital SSO or Microsoft" },
          { key: "client_id", label: "Client ID", required: true },
          { key: "client_secret", label: "Client secret (stored encrypted, never shown again)" },
          { key: "tenant_id", label: "Directory (tenant) ID — Microsoft only" },
          { key: "discovery_url", label: "Discovery URL — other OIDC providers only", placeholder: "https://…/.well-known/openid-configuration" },
          { key: "allowed_domains", label: "Allowed email domains (JSON list)", type: "json", placeholder: '["cityhospital.in"]' },
          { key: "is_enabled", label: "Enabled", type: "boolean", defaultValue: true },
        ],
        actions: [
          { label: "Test", path: "test/", tone: "primary" },
          { label: "Linked staff", path: "identities/", method: "get" },
          { label: "Unlink a staff member", path: "unlink/", tone: "danger", prompt: [{ key: "identity", label: "Identity ID (from Linked staff)", type: "number", required: true }] },
          { label: "Edit", path: "", method: "patch", prompt: [
            { key: "display_name", label: "Button text" }, { key: "client_id", label: "Client ID" }, { key: "client_secret", label: "New client secret (leave blank to keep)" },
            { key: "tenant_id", label: "Tenant ID" }, { key: "allowed_domains", label: "Allowed domains (JSON list)", type: "json" }, { key: "is_enabled", label: "Enabled", type: "boolean" }] },
        ],
      }} />
    </div>
  )
}
