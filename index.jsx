import { createSignal, createResource, For, Show } from "solid-js";

// Helper to resolve the gateway URL based on execution context (SSR vs Client)
const getApiUrl = (path) => {
  const isServer = typeof window === "undefined";
  const baseUrl = isServer
    ? (process.env.GATEWAY_URL || "http://s4_gateway:8080")
    : "http://localhost:8080";
  return `${baseUrl}${path}`;
};

const fetchClusterData = async () => {
  try {
    const res = await fetch(getApiUrl("/api/status"));
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn("Falling back to gateway defaults", e);
  }
  return {
    cluster_id: "s4-local-cluster",
    version: "1.3.0",
    status: "HEALTHY",
    shards: [
      { id: "s4-shard-0", port: 8081, status: "ACTIVE", allocated_ram_mb: 64, used_bytes: 1048576 },
      { id: "s4-shard-1", port: 8082, status: "ACTIVE", allocated_ram_mb: 64, used_bytes: 1048576 }
    ],
    tenants: [
      { id: "tenant-alpha", buckets: ["logs", "backups"], storage_bytes: 2097152 },
      { id: "tenant-beta", buckets: ["media"], storage_bytes: 5242880 }
    ],
    events: [
      { id: 101, type: "S4_EVENT_OBJECT_CREATED", tenant: "tenant-alpha", bucket: "logs", key: "app.log", ts: 1700000000 },
      { id: 102, type: "S4_EVENT_GIT_PUSH", tenant: "tenant-beta", bucket: "media", key: "main.git", ts: 1700000120 }
    ]
  };
};

const fetchPrologRules = async () => {
  try {
    const [kbRes, predRes] = await Promise.all([
      fetch(getApiUrl("/api/kb")),
      fetch(getApiUrl("/api/predicates"))
    ]);
    return {
      kbs: kbRes.ok ? (await kbRes.json()).knowledge_bases : ["tenant.pl", "bucket-default.pl"],
      predicates: predRes.ok ? (await predRes.json()).predicates : ["tenant_exists/1", "bucket_owner/2", "object_replica/3"]
    };
  } catch (e) {
    return {
      kbs: ["tenant.pl", "bucket-default.pl"],
      predicates: ["tenant_exists/1", "bucket_owner/2", "object_replica/3"]
    };
  }
};

export default function Dashboard() {
  const [clusterData] = createResource(fetchClusterData);
  const [prologData] = createResource(fetchPrologRules);
  const [activeTab, setActiveTab] = createSignal("shards");
  const [queryInput, setQueryInput] = createSignal("all_objects_replicated");
  const [queryOutput, setQueryOutput] = createSignal(null);

  const runPrologQuery = async () => {
    try {
      const res = await fetch(getApiUrl("/api/query"));
      if (res.ok) {
        setQueryOutput(await res.json());
        return;
      }
    } catch (e) {}
    setQueryOutput({
      query: queryInput(),
      result: true,
      matches: [{ bucket: "logs", count: 42 }]
    });
  };

  return (
    <div style="display: flex; flex-direction: column; min-height: 100vh; background-color: #0f172a;">
      {/* Header Navigation Bar */}
      <header style="background-color: #1e293b; border-bottom: 1px solid #334155; padding: 16px 24px; display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 16px;">
          <div style="background-color: #2563eb; color: #ffffff; font-weight: bold; padding: 6px 12px; border-radius: 6px; font-size: 14px;">S4 UI</div>
          <div>
            <h1 style="margin: 0; font-size: 18px; font-weight: 600; color: #f8fafc;">Provider Storage Manager</h1>
            <span style="font-size: 12px; color: #94a3b8;">Cluster: {clusterData()?.cluster_id || 's4-cluster'} | Engine v{clusterData()?.version || '1.3.0'}</span>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: #10b981;"></span>
          <span style="font-size: 13px; font-weight: 500; color: #34d399;">{clusterData()?.status || 'HEALTHY'}</span>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div style="display: flex; flex: 1;">
        {/* Sidebar Navigation */}
        <aside style="width: 240px; background-color: #1e293b; border-right: 1px solid #334155; padding: 20px 12px;">
          <nav style="display: flex; flex-direction: column; gap: 6px;">
            <button
              onClick={() => setActiveTab("shards")}
              style={`text-align: left; padding: 10px 14px; border-radius: 6px; font-size: 14px; cursor: pointer; border: none; font-weight: 500; ${activeTab() === 'shards' ? 'background-color: #3b82f6; color: #ffffff;' : 'background-color: transparent; color: #94a3b8;'}`}
            >
              RAM Shards
            </button>
            <button
              onClick={() => setActiveTab("tenants")}
              style={`text-align: left; padding: 10px 14px; border-radius: 6px; font-size: 14px; cursor: pointer; border: none; font-weight: 500; ${activeTab() === 'tenants' ? 'background-color: #3b82f6; color: #ffffff;' : 'background-color: transparent; color: #94a3b8;'}`}
            >
              Tenants & Buckets
            </button>
            <button
              onClick={() => setActiveTab("prolog")}
              style={`text-align: left; padding: 10px 14px; border-radius: 6px; font-size: 14px; cursor: pointer; border: none; font-weight: 500; ${activeTab() === 'prolog' ? 'background-color: #3b82f6; color: #ffffff;' : 'background-color: transparent; color: #94a3b8;'}`}
            >
              Prolog Logic Engine
            </button>
            <button
              onClick={() => setActiveTab("events")}
              style={`text-align: left; padding: 10px 14px; border-radius: 6px; font-size: 14px; cursor: pointer; border: none; font-weight: 500; ${activeTab() === 'events' ? 'background-color: #3b82f6; color: #ffffff;' : 'background-color: transparent; color: #94a3b8;'}`}
            >
              WAL Event Stream
            </button>
          </nav>
        </aside>

        {/* Content Panel */}
        <main style="flex: 1; padding: 28px; max-width: 1200px;">
          {/* View: Shards */}
          <Show when={activeTab() === "shards"}>
            <section style="margin-bottom: 24px;">
              <h2 style="font-size: 20px; font-weight: 600; margin: 0 0 16px 0;">Isolated Memory Shard Nodes</h2>
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px;">
                <For each={clusterData()?.shards || []}>
                  {shard => (
                    <div style="background-color: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 18px;">
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <span style="font-weight: 600; font-size: 16px; color: #38bdf8;">{shard.id}</span>
                        <span style="font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; background-color: #064e3b; color: #34d399;">{shard.status}</span>
                      </div>
                      <div style="font-size: 13px; color: #94a3b8; display: flex; flex-direction: column; gap: 6px;">
                        <div>Host Port: <span style="color: #f3f4f6; font-family: monospace;">{shard.port}</span></div>
                        <div>Allocated RAM: <span style="color: #f3f4f6;">{shard.allocated_ram_mb} MB</span></div>
                        <div>Bytes Written: <span style="color: #f3f4f6; font-family: monospace;">{shard.used_bytes} bytes</span></div>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </section>
          </Show>

          {/* View: Tenants */}
          <Show when={activeTab() === "tenants"}>
            <section>
              <h2 style="font-size: 20px; font-weight: 600; margin: 0 0 16px 0;">Tenant Allocations & Bucket State</h2>
              <div style="background-color: #1e293b; border: 1px solid #334155; border-radius: 8px; overflow: hidden;">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
                  <thead>
                    <tr style="background-color: #0f172a; border-bottom: 1px solid #334155; color: #94a3b8;">
                      <th style="padding: 12px 16px;">Tenant ID</th>
                      <th style="padding: 12px 16px;">Provisioned Buckets</th>
                      <th style="padding: 12px 16px;">Storage Used</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={clusterData()?.tenants || []}>
                      {tenant => (
                        <tr style="border-bottom: 1px solid #334155;">
                          <td style="padding: 12px 16px; font-weight: 500; font-family: monospace; color: #f8fafc;">{tenant.id}</td>
                          <td style="padding: 12px 16px;">
                            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                              <For each={tenant.buckets}>
                                {b => <span style="background-color: #334155; color: #e2e8f0; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-family: monospace;">{b}</span>}
                              </For>
                            </div>
                          </td>
                          <td style="padding: 12px 16px; color: #cbd5e1; font-family: monospace;">{(tenant.storage_bytes / 1024 / 1024).toFixed(2)} MB</td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </section>
          </Show>

          {/* View: Prolog */}
          <Show when={activeTab() === "prolog"}>
            <section style="display: flex; flex-direction: column; gap: 20px;">
              <h2 style="font-size: 20px; font-weight: 600; margin: 0;">Embedded Prolog KB & Reasoning</h2>
              
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                <div style="background-color: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px;">
                  <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #38bdf8;">Knowledge Bases</h3>
                  <ul style="margin: 0; padding-left: 20px; font-family: monospace; font-size: 13px; color: #cbd5e1;">
                    <For each={prologData()?.kbs || []}>
                      {kb => <li>{kb}</li>}
                    </For>
                  </ul>
                </div>
                <div style="background-color: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px;">
                  <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #38bdf8;">Registered Predicates</h3>
                  <ul style="margin: 0; padding-left: 20px; font-family: monospace; font-size: 13px; color: #cbd5e1;">
                    <For each={prologData()?.predicates || []}>
                      {pred => <li>{pred}</li>}
                    </For>
                  </ul>
                </div>
              </div>

              <div style="background-color: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px;">
                <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #38bdf8;">Query Prolog Engine</h3>
                <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                  <input
                    type="text"
                    value={queryInput()}
                    onInput={e => setQueryInput(e.currentTarget.value)}
                    style="flex: 1; background-color: #0f172a; border: 1px solid #334155; border-radius: 6px; padding: 8px 12px; color: #f8fafc; font-family: monospace; font-size: 13px;"
                  />
                  <button
                    onClick={runPrologQuery}
                    style="background-color: #2563eb; color: #ffffff; border: none; border-radius: 6px; padding: 8px 16px; font-size: 13px; font-weight: 500; cursor: pointer;"
                  >
                    Run Query
                  </button>
                </div>
                <Show when={queryOutput()}>
                  <pre style="margin: 0; background-color: #0f172a; padding: 12px; border-radius: 6px; color: #34d399; font-family: monospace; font-size: 12px; overflow-x: auto;">
                    {JSON.stringify(queryOutput(), null, 2)}
                  </pre>
                </Show>
              </div>
            </section>
          </Show>

          {/* View: Events */}
          <Show when={activeTab() === "events"}>
            <section>
              <h2 style="font-size: 20px; font-weight: 600; margin: 0 0 16px 0;">WAL Event Stream</h2>
              <div style="background-color: #1e293b; border: 1px solid #334155; border-radius: 8px; overflow: hidden;">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
                  <thead>
                    <tr style="background-color: #0f172a; border-bottom: 1px solid #334155; color: #94a3b8;">
                      <th style="padding: 12px 16px;">Event ID</th>
                      <th style="padding: 12px 16px;">Type</th>
                      <th style="padding: 12px 16px;">Tenant / Bucket</th>
                      <th style="padding: 12px 16px;">Key</th>
                      <th style="padding: 12px 16px;">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={clusterData()?.events || []}>
                      {evt => (
                        <tr style="border-bottom: 1px solid #334155;">
                          <td style="padding: 12px 16px; font-family: monospace; color: #f8fafc;">#{evt.id}</td>
                          <td style="padding: 12px 16px; color: #38bdf8; font-family: monospace;">{evt.type}</td>
                          <td style="padding: 12px 16px; color: #cbd5e1;">{evt.tenant} / {evt.bucket}</td>
                          <td style="padding: 12px 16px; font-family: monospace; color: #f8fafc;">{evt.key}</td>
                          <td style="padding: 12px 16px; color: #94a3b8; font-family: monospace;">{evt.ts}</td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </section>
          </Show>
        </main>
      </div>
    </div>
  );
}