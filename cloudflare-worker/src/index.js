import { buildPushPayload } from "@block65/webcrypto-web-push";

const ALLOWED_ORIGIN = "https://7hasan.github.io";
const MAX_BATCH = 40;
const SESSION_DAYS = 7;
const PASSWORD_ITERATIONS = 100000;

function json(data, status = 200, origin = ALLOWED_ORIGIN) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin"
    }
  });
}

function validSubscription(sub) {
  return sub && typeof sub.endpoint === "string" &&
    sub.endpoint.startsWith("https://") &&
    typeof sub.keys?.p256dh === "string" &&
    typeof sub.keys?.auth === "string" &&
    sub.keys.p256dh.length >= 20 && sub.keys.auth.length >= 10;
}

function randomHex(bytes = 32) {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(data, b => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}

function toBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits({
    name: "PBKDF2",
    salt: new TextEncoder().encode(salt),
    iterations: PASSWORD_ITERATIONS,
    hash: "SHA-256"
  }, key, 256);
  return toBase64(new Uint8Array(bits));
}

function safeUser(row) {
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    email: row.email || "",
    role: row.role,
    active: Boolean(row.active),
    created_at: row.created_at
  };
}

async function readJson(request, maxBytes = 12000) {
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > maxBytes) throw new Error("REQUEST_TOO_LARGE");
  return request.json();
}

async function createSession(env, user) {
  const token = randomHex(32);
  const tokenHash = await sha256(token);
  await env.DB.prepare(
    "INSERT INTO admin_sessions (token_hash,user_id,expires_at) VALUES (?,?,datetime('now', ?))"
  ).bind(tokenHash, user.id, `+${SESSION_DAYS} days`).run();
  return token;
}

async function authenticate(request, env) {
  const header = request.headers.get("Authorization") || "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const tokenHash = await sha256(token);
  const row = await env.DB.prepare(`
    SELECT u.id,u.username,u.name,u.email,u.role,u.active,u.created_at
    FROM admin_sessions s
    JOIN admin_users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.expires_at > datetime('now') AND u.active=1
  `).bind(tokenHash).first();
  return row || null;
}

async function requireUser(request, env, roles = ["admin", "employee"]) {
  const user = await authenticate(request, env);
  if (!user) return { response: json({ error: "انتهت الجلسة أو بيانات الدخول غير صحيحة" }, 401) };
  if (!roles.includes(user.role)) return { response: json({ error: "ليست لديك صلاحية لتنفيذ هذه العملية" }, 403) };
  return { user };
}

async function sendPush(message, env, actorId) {
  if (typeof message.title !== "string" || typeof message.body !== "string" ||
      !message.title.trim() || !message.body.trim() ||
      message.title.length > 100 || message.body.length > 500) {
    return { response: json({ error: "Invalid title or body" }, 400) };
  }

  const targetUrl = typeof message.url === "string" && message.url.startsWith("/") &&
    !message.url.startsWith("//") ? message.url : "/AlJoud_Coffee/";

  const { results } = await env.DB.prepare(`
    SELECT id,endpoint,p256dh,auth FROM push_subscriptions
    WHERE enabled=1 ORDER BY id ASC LIMIT ?
  `).bind(MAX_BATCH).all();

  const vapid = {
    subject: env.VAPID_SUBJECT,
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY
  };

  const outcomes = await Promise.all(results.map(async row => {
    const subscription = {
      endpoint: row.endpoint,
      expirationTime: null,
      keys: { p256dh: row.p256dh, auth: row.auth }
    };
    try {
      const payload = await buildPushPayload({
        data: JSON.stringify({
          title: message.title.trim(),
          body: message.body.trim(),
          url: targetUrl
        }),
        options: { ttl: 3600 }
      }, subscription, vapid);

      const response = await fetch(row.endpoint, payload);
      if (response.status === 404 || response.status === 410) {
        await env.DB.prepare("DELETE FROM push_subscriptions WHERE id=?").bind(row.id).run();
        return "expired";
      }
      return response.ok ? "sent" : "failed";
    } catch (error) {
      console.error("Push delivery error:", error);
      return "failed";
    }
  }));

  const sent = outcomes.filter(x => x === "sent").length;
  const expired = outcomes.filter(x => x === "expired").length;
  const failed = outcomes.filter(x => x === "failed").length;
  const result = {
    success: true,
    processed: results.length,
    sent,
    failed,
    expired,
    batchLimit: MAX_BATCH,
    remaining: await env.DB.prepare("SELECT COUNT(*) AS total FROM push_subscriptions WHERE enabled=1").first().then(r => Math.max(0, (r?.total || 0) - results.length))
  };

  await env.DB.prepare(`
    INSERT INTO notification_logs
      (title,body,target_url,processed,sent,failed,expired,actor_user_id)
    VALUES (?,?,?,?,?,?,?,?)
  `).bind(message.title.trim(), message.body.trim(), targetUrl,
    result.processed, sent, failed, expired, actorId || null).run();

  return { result };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    if (origin && origin !== ALLOWED_ORIGIN) return json({ error: "Origin not allowed" }, 403);
    if (request.method === "OPTIONS") return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
        "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin"
      }
    });

    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (request.method === "GET" && path === "/") {
        return json({ success: true, service: "AlJoud Push API", status: "running", adminPortal: true });
      }

      if (request.method === "POST" && path === "/subscribe") {
        const sub = await readJson(request);
        if (!validSubscription(sub)) return json({ error: "Invalid push subscription" }, 400);
        await env.DB.prepare(`
          INSERT INTO push_subscriptions (endpoint,p256dh,auth,enabled,updated_at)
          VALUES (?,?,?,1,CURRENT_TIMESTAMP)
          ON CONFLICT(endpoint) DO UPDATE SET
            p256dh=excluded.p256dh,auth=excluded.auth,enabled=1,updated_at=CURRENT_TIMESTAMP
        `).bind(sub.endpoint, sub.keys.p256dh, sub.keys.auth).run();
        return json({ success: true, message: "Subscription saved" }, 201);
      }

      if (request.method === "POST" && path === "/auth/bootstrap") {
        if (!env.BOOTSTRAP_SECRET) return json({ error: "تهيئة المدير غير مفعلة على الخادم" }, 503);
        const body = await readJson(request, 6000);
        const existing = await env.DB.prepare("SELECT COUNT(*) AS total FROM admin_users WHERE role='admin'").first();
        if ((existing?.total || 0) > 0) return json({ error: "تم إنشاء حساب المدير مسبقاً" }, 409);
        if (typeof body.bootstrapKey !== "string" || body.bootstrapKey !== env.BOOTSTRAP_SECRET) {
          return json({ error: "مفتاح التهيئة غير صحيح" }, 401);
        }
        const name = String(body.name || "").trim();
        const username = String(body.username || "").trim().toLowerCase();
        const email = String(body.email || "").trim().toLowerCase();
        const password = String(body.password || "");
        if (name.length < 2 || !/^[a-z0-9_.-]{3,40}$/.test(username) ||
            password.length < 12 || password.length > 200 ||
            (email && (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))) {
          return json({ error: "تحقق من الاسم واسم المستخدم والبريد وكلمة المرور (12 حرفاً على الأقل)" }, 400);
        }
        const id = randomHex(16), salt = randomHex(16);
        const passwordHash = await hashPassword(password, salt);
        await env.DB.prepare(`
          INSERT INTO admin_users (id,username,name,email,role,password_hash,password_salt,active)
          VALUES (?,?,?,?, 'admin',?,?,1)
        `).bind(id, username, name, email, passwordHash, salt).run();
        const user = await env.DB.prepare("SELECT * FROM admin_users WHERE id=?").bind(id).first();
        const session = await createSession(env, user);
        return json({ success: true, token: session, user: safeUser(user) }, 201);
      }

      if (request.method === "POST" && path === "/auth/login") {
        const body = await readJson(request, 4000);
        const username = String(body.username || "").trim().toLowerCase();
        const password = String(body.password || "");
        if (!username || !password || password.length > 200) return json({ error: "أدخل اسم المستخدم وكلمة المرور" }, 400);
        const user = await env.DB.prepare("SELECT * FROM admin_users WHERE username=?").bind(username).first();
        // Perform a password derivation even for unknown usernames to reduce account enumeration timing.
        const salt = user?.password_salt || "aljoud-invalid-user-salt";
        const candidate = await hashPassword(password, salt);
        if (!user || !user.active || candidate !== user.password_hash) {
          return json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" }, 401);
        }
        const session = await createSession(env, user);
        return json({ success: true, token: session, user: safeUser(user) });
      }

      if (request.method === "GET" && path === "/auth/me") {
        const auth = await requireUser(request, env);
        return auth.response || json({ success: true, user: safeUser(auth.user) });
      }

      if (request.method === "POST" && path === "/auth/logout") {
        const header = request.headers.get("Authorization") || "";
        const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
        if (/^[a-f0-9]{64}$/.test(token)) {
          await env.DB.prepare("DELETE FROM admin_sessions WHERE token_hash=?").bind(await sha256(token)).run();
        }
        return json({ success: true });
      }

      if (path === "/admin/send" && request.method === "POST") {
        let actorId = null;
        const auth = await requireUser(request, env);
        if (auth.user) actorId = auth.user.id;
        else {
          const legacy = request.headers.get("Authorization") || "";
          if (!env.ADMIN_API_KEY || legacy !== `Bearer ${env.ADMIN_API_KEY}`) return auth.response;
        }
        const body = await readJson(request, 5000);
        const sent = await sendPush(body, env, actorId);
        return sent.response || json(sent.result);
      }

      if (path === "/admin/stats" && request.method === "GET") {
        const auth = await requireUser(request, env);
        if (auth.response) return auth.response;
        const subscribers = await env.DB.prepare("SELECT COUNT(*) AS total FROM push_subscriptions WHERE enabled=1").first();
        const totals = await env.DB.prepare("SELECT COALESCE(SUM(sent),0) AS sent,COALESCE(SUM(failed),0) AS failed FROM notification_logs").first();
        const { results: history } = await env.DB.prepare(`
          SELECT id,title,processed,sent,failed,expired,created_at
          FROM notification_logs ORDER BY id DESC LIMIT 12
        `).all();
        return json({ success: true, subscribers: subscribers?.total || 0, sent: totals?.sent || 0, failed: totals?.failed || 0, history });
      }

      if (path === "/admin/users" && request.method === "GET") {
        const auth = await requireUser(request, env, ["admin"]);
        if (auth.response) return auth.response;
        const { results } = await env.DB.prepare(`
          SELECT id,username,name,email,role,active,created_at
          FROM admin_users ORDER BY created_at DESC
        `).all();
        return json({ success: true, users: results.map(safeUser) });
      }

      if (path === "/admin/users" && request.method === "POST") {
        const auth = await requireUser(request, env, ["admin"]);
        if (auth.response) return auth.response;
        const body = await readJson(request, 6000);
        const name = String(body.name || "").trim();
        const username = String(body.username || "").trim().toLowerCase();
        const email = String(body.email || "").trim().toLowerCase();
        const password = String(body.password || "");
        if (name.length < 2 || !/^[a-z0-9_.-]{3,40}$/.test(username) ||
            password.length < 12 || password.length > 200 ||
            (email && (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))) {
          return json({ error: "تحقق من البيانات، وكلمة المرور يجب ألا تقل عن 12 حرفاً" }, 400);
        }
        const id = randomHex(16), salt = randomHex(16);
        const passwordHash = await hashPassword(password, salt);
        try {
          await env.DB.prepare(`
            INSERT INTO admin_users (id,username,name,email,role,password_hash,password_salt,active)
            VALUES (?,?,?,?, 'employee',?,?,1)
          `).bind(id, username, name, email, passwordHash, salt).run();
        } catch {
          return json({ error: "اسم المستخدم مستخدم مسبقاً أو تعذر إنشاء الحساب" }, 409);
        }
        const created = await env.DB.prepare("SELECT id,username,name,email,role,active,created_at FROM admin_users WHERE id=?").bind(id).first();
        return json({ success: true, user: safeUser(created) }, 201);
      }

      if (path.startsWith("/admin/users/") && request.method === "PATCH") {
        const auth = await requireUser(request, env, ["admin"]);
        if (auth.response) return auth.response;
        const id = decodeURIComponent(path.slice("/admin/users/".length));
        const body = await readJson(request, 1000);
        if (typeof body.active !== "boolean") return json({ error: "قيمة حالة الحساب غير صحيحة" }, 400);
        const target = await env.DB.prepare("SELECT id,role FROM admin_users WHERE id=?").bind(id).first();
        if (!target || target.role === "admin") return json({ error: "الحساب غير موجود أو لا يمكن تعطيله" }, 404);
        await env.DB.prepare("UPDATE admin_users SET active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(body.active ? 1 : 0, id).run();
        if (!body.active) await env.DB.prepare("DELETE FROM admin_sessions WHERE user_id=?").bind(id).run();
        return json({ success: true });
      }

      return json({ error: "Not found" }, 404);
    } catch (error) {
      console.error("Worker error:", error);
      if (error?.message === "REQUEST_TOO_LARGE") return json({ error: "Request too large" }, 413);
      if (error?.message?.includes("UNIQUE constraint failed")) return json({ error: "اسم المستخدم مستخدم مسبقاً" }, 409);
      return json({ error: "Internal server error" }, 500);
    }
  }
};
