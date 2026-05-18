/**
 * Shared HMAC token helpers for admin authentication.
 * Uses Web Crypto API (available in Cloudflare Workers runtime).
 */

const TOKEN_MAX_AGE_MS = 4 * 60 * 60 * 1000; // 4 hours

async function hmacSign(message, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function hmacVerify(message, signature, secret) {
  const expected = await hmacSign(message, secret);
  // Constant-time-ish comparison (both are base64 strings of same length)
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

export async function generateToken(secret) {
  const ts = Date.now().toString();
  const sig = await hmacSign(ts, secret);
  return btoa(ts + ":" + sig);
}

export async function validateToken(token, secret) {
  try {
    const decoded = atob(token);
    const colonIdx = decoded.indexOf(":");
    if (colonIdx === -1) return false;

    const ts = decoded.substring(0, colonIdx);
    const sig = decoded.substring(colonIdx + 1);

    // Check expiry
    const age = Date.now() - parseInt(ts, 10);
    if (isNaN(age) || age < 0 || age > TOKEN_MAX_AGE_MS) return false;

    // Verify signature
    return await hmacVerify(ts, sig, secret);
  } catch {
    return false;
  }
}

export function corsHeaders(request) {
  return {
    "Access-Control-Allow-Origin": request.headers.get("Origin") || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}
