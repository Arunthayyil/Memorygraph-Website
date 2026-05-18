/**
 * POST /api/admin/auth
 * Validates admin password, returns HMAC token.
 *
 * Requires env vars:
 *   ADMIN_PASSWORD — the admin password (set in Cloudflare Pages dashboard)
 */
import { generateToken } from "./_auth-utils.js";

export async function onRequestPost(context) {
  try {
    const { password } = await context.request.json();
    const adminPassword = context.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      return Response.json(
        { ok: false, error: "Admin not configured" },
        { status: 500 }
      );
    }

    if (!password || typeof password !== "string") {
      return Response.json(
        { ok: false, error: "Password required" },
        { status: 400 }
      );
    }

    // Constant-time-ish comparison
    const enc = new TextEncoder();
    const a = enc.encode(password);
    const b = enc.encode(adminPassword);
    let match = a.length === b.length;
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
      if ((a[i] || 0) !== (b[i] || 0)) match = false;
    }

    if (!match) {
      return Response.json(
        { ok: false, error: "Invalid password" },
        { status: 401 }
      );
    }

    const token = await generateToken(adminPassword);
    return Response.json({ ok: true, token });
  } catch (err) {
    return Response.json(
      { ok: false, error: "Bad request" },
      { status: 400 }
    );
  }
}
