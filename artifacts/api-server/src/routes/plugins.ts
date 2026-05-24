/**
 * /api/plugins — Plugin Engine management
 */
import { Router } from "express";
import { requireAuth, requireAdmin } from "../middlewares/auth.js";
import { pluginEngine } from "../lib/plugin-engine.js";

const router = Router();
router.use(requireAuth);

// GET /api/plugins
router.get("/", (_req, res) => {
  const plugins = pluginEngine.getAll().map((p) => ({
    id: p.manifest.id,
    name: p.manifest.name,
    version: p.manifest.version,
    description: p.manifest.description,
    author: p.manifest.author,
    kind: p.manifest.kind,
    hooks: p.manifest.hooks,
    permissions: p.manifest.permissions,
    configSchema: p.manifest.configSchema,
    config: p.config,
    status: p.status,
    errorMessage: p.errorMessage,
    loadedAt: p.loadedAt,
    lastEventAt: p.lastEventAt,
    eventCount: p.eventCount,
  }));
  res.json(plugins);
});

// GET /api/plugins/:id
router.get("/:id", (req, res) => {
  const plugin = pluginEngine.get(req.params["id"] ?? "");
  if (!plugin) {
    res.status(404).json({ error: "Plugin not found" });
    return;
  }
  res.json(plugin);
});

// POST /api/plugins — install plugin
router.post("/", requireAdmin, async (req, res) => {
  const { manifest, config } = req.body as {
    manifest: Parameters<typeof pluginEngine.installPlugin>[0];
    config?: Record<string, unknown>;
  };

  if (!manifest?.id || !manifest?.name) {
    res.status(400).json({ error: "manifest.id and manifest.name required" });
    return;
  }

  try {
    await pluginEngine.installPlugin(manifest, config ?? {});
    res.status(201).json({ ok: true, id: manifest.id });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

function getParamId(p: string | string[]): string {
  return Array.isArray(p) ? (p[0] ?? "") : p;
}

// PATCH /api/plugins/:id/enable
router.patch("/:id/enable", requireAdmin, (req, res) => {
  try {
    pluginEngine.enablePlugin(getParamId(req.params["id"] ?? ""));
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// PATCH /api/plugins/:id/disable
router.patch("/:id/disable", requireAdmin, (req, res) => {
  try {
    pluginEngine.disablePlugin(getParamId(req.params["id"] ?? ""));
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// PATCH /api/plugins/:id/config
router.patch("/:id/config", requireAdmin, (req, res) => {
  try {
    pluginEngine.updatePluginConfig(getParamId(req.params["id"] ?? ""), req.body as Record<string, unknown>);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// DELETE /api/plugins/:id
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    await pluginEngine.uninstallPlugin(getParamId(req.params["id"] ?? ""));
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

export default router;
