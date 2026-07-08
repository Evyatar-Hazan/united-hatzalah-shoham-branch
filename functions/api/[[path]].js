const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'access-control-allow-headers': 'Content-Type, Authorization',
    },
  });

const ok = (data, message) => json({ success: true, data, message, timestamp: new Date().toISOString() });
const fail = (error, status = 400) => json({ success: false, error, timestamp: new Date().toISOString() }, status);
const id = () => crypto.randomUUID();

const parseBody = async (request) => {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    return request.formData();
  }
  if (contentType.includes('application/json')) {
    return request.json();
  }
  return {};
};

const all = async (db, sql, ...params) => (await db.prepare(sql).bind(...params).all()).results || [];
const first = (db, sql, ...params) => db.prepare(sql).bind(...params).first();
const run = (db, sql, ...params) => db.prepare(sql).bind(...params).run();

let schemaReady = false;

const INIT_SQL = `
CREATE TABLE IF NOT EXISTS donors (id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, logo TEXT, createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS donations (id TEXT PRIMARY KEY, amount REAL NOT NULL, donorName TEXT NOT NULL, donorEmail TEXT NOT NULL, message TEXT, status TEXT NOT NULL DEFAULT 'completed', createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS admins (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, picture TEXT, isActive INTEGER NOT NULL DEFAULT 1, lastLogin TEXT, createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS gallery_items (id TEXT PRIMARY KEY, title TEXT NOT NULL, category TEXT NOT NULL, imageUrl TEXT NOT NULL, createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS stories (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL, date TEXT NOT NULL, image TEXT, createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS stat_items (id TEXT PRIMARY KEY, title TEXT NOT NULL, value REAL NOT NULL, unit TEXT, sortOrder INTEGER NOT NULL DEFAULT 0, createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS contact_messages (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT, subject TEXT NOT NULL, message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS contact_info (id TEXT PRIMARY KEY DEFAULT 'main', phone TEXT NOT NULL, email TEXT NOT NULL, address TEXT NOT NULL, emergencyNumber TEXT NOT NULL, facebook TEXT NOT NULL DEFAULT '#', instagram TEXT NOT NULL DEFAULT '#', whatsapp TEXT NOT NULL DEFAULT '#', weekday TEXT NOT NULL DEFAULT '08:00 - 18:00', weekend TEXT NOT NULL DEFAULT '09:00 - 17:00', updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO admins (id, email, name, isActive) VALUES ('admin-default', 'admin@shoham.united-hatzalah.org.il', 'מנהל סניף שוהם', 1);
INSERT OR IGNORE INTO stat_items (id, title, value, unit, sortOrder) VALUES ('stat-volunteers', 'מתנדבים פעילים', 247, NULL, 1), ('stat-calls', 'קריאות חירום בשנה', 3847, NULL, 2), ('stat-response', 'זמן תגובה ממוצע', 4.2, 'דקות', 3), ('stat-availability', 'זמינות מערכת', 99.8, '%', 4);
INSERT OR IGNORE INTO donors (id, name, category, logo) VALUES ('donor-1', 'בנק הפועלים', 'שותף קבוע', NULL), ('donor-2', 'דן תחבורה', 'תורם', NULL), ('donor-3', 'סופרמרקט שומרון', 'תורם', NULL);
INSERT OR IGNORE INTO stories (id, title, description, date, image) VALUES ('story-1', 'הגעה מהירה לקריאת חירום', 'מתנדבי הסניף הגיעו בתוך דקות והעניקו טיפול ראשוני עד להגעת צוותי המשך.', '2026-01-20', NULL), ('story-2', 'הדרכת עזרה ראשונה לקהילה', 'הסניף קיים הדרכה מעשית לתושבים והרחיב את מעגל האנשים שיודעים להגיב בשעת חירום.', '2026-01-10', NULL);
INSERT OR IGNORE INTO gallery_items (id, title, category, imageUrl) VALUES ('gallery-1', 'הדרכת מתנדבים', 'הכשרה', 'https://placehold.co/800x600/f2561a/ffffff?text=Training'), ('gallery-2', 'ציוד רפואי', 'ציוד', 'https://placehold.co/800x600/1a1a18/ffffff?text=Equipment'), ('gallery-3', 'פעילות קהילתית', 'קהילה', 'https://placehold.co/800x600/ff6b35/ffffff?text=Community');
INSERT OR IGNORE INTO contact_info (id, phone, email, address, emergencyNumber, facebook, instagram, whatsapp) VALUES ('main', '+972-XX-XXX-XXXX', 'contact@shoham.united-hatzalah.org.il', 'איחוד הצלה סניף שוהם', '101', 'https://facebook.com/your-page', 'https://instagram.com/your-page', 'https://wa.me/your-number');
`;

const ensureSchema = async (db) => {
  if (schemaReady) return;
  await db.exec(INIT_SQL);
  schemaReady = true;
};

const normalizeStat = (row) => row && ({ ...row, order: row.sortOrder });
const normalizeAdmin = (row) => row && ({ ...row, isActive: Boolean(row.isActive), isAdmin: Boolean(row.isActive) });
const contactInfoFromRow = (row) => ({
  phone: row?.phone || '+972-XX-XXX-XXXX',
  email: row?.email || 'contact@shoham.united-hatzalah.org.il',
  address: row?.address || 'איחוד הצלה סניף שוהם',
  emergencyNumber: row?.emergencyNumber || '101',
  businessHours: {
    weekday: row?.weekday || '08:00 - 18:00',
    weekend: row?.weekend || '09:00 - 17:00',
  },
  socialLinks: {
    facebook: row?.facebook || '#',
    instagram: row?.instagram || '#',
    whatsapp: row?.whatsapp || '#',
  },
});

const requireAdmin = async (request, env) => {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ')) return null;
  const email = header.slice(7).trim().toLowerCase();
  if (!email) return null;
  const admin = await first(env.DB, 'SELECT * FROM admins WHERE lower(email) = ? AND isActive = 1', email);
  return normalizeAdmin(admin);
};

const tableConfig = {
  gallery: {
    table: 'gallery_items',
    fields: ['title', 'category', 'imageUrl'],
    listSql: 'SELECT * FROM gallery_items ORDER BY createdAt DESC',
  },
  stories: {
    table: 'stories',
    fields: ['title', 'description', 'date', 'image'],
    listSql: 'SELECT * FROM stories ORDER BY createdAt DESC',
  },
  donors: {
    table: 'donors',
    fields: ['name', 'category', 'logo'],
    listSql: 'SELECT * FROM donors ORDER BY createdAt DESC',
  },
  admins: {
    table: 'admins',
    fields: ['email', 'name', 'picture', 'isActive'],
    listSql: 'SELECT * FROM admins WHERE isActive = 1 ORDER BY createdAt DESC',
    normalize: normalizeAdmin,
  },
  donations: {
    table: 'donations',
    fields: ['amount', 'donorName', 'donorEmail', 'message', 'status'],
    listSql: 'SELECT * FROM donations ORDER BY createdAt DESC',
  },
  'stat-items': {
    table: 'stat_items',
    fields: ['title', 'value', 'unit', 'sortOrder'],
    listSql: 'SELECT *, sortOrder as "order" FROM stat_items ORDER BY sortOrder ASC, createdAt ASC',
  },
};

const createRow = async (env, config, body) => {
  const newId = id();
  const now = new Date().toISOString();
  const fields = config.fields.filter((field) => body[field] !== undefined || (field === 'sortOrder' && body.order !== undefined));
  const values = fields.map((field) => {
    if (field === 'sortOrder') return Number(body.sortOrder ?? body.order ?? 0);
    if (field === 'isActive') return body[field] === false ? 0 : 1;
    return body[field] ?? null;
  });
  const columns = ['id', ...fields, 'createdAt', 'updatedAt'];
  const placeholders = columns.map(() => '?').join(', ');
  await run(env.DB, `INSERT INTO ${config.table} (${columns.join(', ')}) VALUES (${placeholders})`, newId, ...values, now, now);
  const row = await first(env.DB, `SELECT * FROM ${config.table} WHERE id = ?`, newId);
  return config.normalize ? config.normalize(row) : normalizeStat(row) || row;
};

const updateRow = async (env, config, rowId, body) => {
  const now = new Date().toISOString();
  const fields = config.fields.filter((field) => body[field] !== undefined || (field === 'sortOrder' && body.order !== undefined));
  if (fields.length === 0) return first(env.DB, `SELECT * FROM ${config.table} WHERE id = ?`, rowId);
  const assignments = fields.map((field) => `${field} = ?`).join(', ');
  const values = fields.map((field) => {
    if (field === 'sortOrder') return Number(body.sortOrder ?? body.order ?? 0);
    if (field === 'isActive') return body[field] === false ? 0 : 1;
    return body[field] ?? null;
  });
  await run(env.DB, `UPDATE ${config.table} SET ${assignments}, updatedAt = ? WHERE id = ?`, ...values, now, rowId);
  const row = await first(env.DB, `SELECT * FROM ${config.table} WHERE id = ?`, rowId);
  return config.normalize ? config.normalize(row) : normalizeStat(row) || row;
};

const deleteRow = async (env, config, rowId, admin) => {
  if (config.table === 'admins') {
    if (admin?.id === rowId) return fail('Cannot delete current admin', 400);
    await run(env.DB, 'UPDATE admins SET isActive = 0, updatedAt = ? WHERE id = ?', new Date().toISOString(), rowId);
    return ok({ success: true }, 'Admin deactivated successfully');
  }
  await run(env.DB, `DELETE FROM ${config.table} WHERE id = ?`, rowId);
  return ok({ success: true }, 'Deleted successfully');
};

const handlePublic = async (request, env, path) => {
  const method = request.method;

  if (path === '/health') {
    return ok({ status: 'ok', runtime: 'cloudflare-pages-functions' });
  }

  if (method === 'GET' && path === '/donors') {
    return ok(await all(env.DB, tableConfig.donors.listSql));
  }

  if (method === 'GET' && path === '/statistics') {
    return ok(await all(env.DB, tableConfig['stat-items'].listSql));
  }

  if (method === 'GET' && path === '/media/gallery') {
    return ok(await all(env.DB, tableConfig.gallery.listSql));
  }

  if (method === 'GET' && path === '/media/stories') {
    return ok(await all(env.DB, tableConfig.stories.listSql));
  }

  if (method === 'POST' && path === '/donations') {
    const body = await parseBody(request);
    const amount = Number(body.amount);
    if (!amount || amount <= 0) return fail('Amount must be positive');
    const donation = await createRow(env, tableConfig.donations, {
      amount,
      donorName: body.donorName || 'Anonymous',
      donorEmail: body.donorEmail || 'donor@example.com',
      message: body.message || null,
      status: 'completed',
    });
    return json({ success: true, data: donation, message: 'Donation received successfully', timestamp: new Date().toISOString() }, 201);
  }

  if (method === 'GET' && path === '/donations/stats') {
    const stats = await first(env.DB, 'SELECT COUNT(*) as totalDonations, COALESCE(SUM(amount), 0) as totalAmount FROM donations');
    return ok(stats);
  }

  if (method === 'POST' && path === '/contact') {
    const body = await parseBody(request);
    if (!body.name || !body.email || !body.message) return fail('name, email and message are required');
    const message = await createRow(
      env,
      {
        table: 'contact_messages',
        fields: ['name', 'email', 'phone', 'subject', 'message', 'status'],
      },
      {
        name: body.name,
        email: body.email,
        phone: body.phone || null,
        subject: body.subject || 'פנייה מהאתר',
        message: body.message,
        status: 'pending',
      }
    );
    return json({ success: true, data: message, message: 'Contact message received successfully', timestamp: new Date().toISOString() }, 201);
  }

  if (method === 'GET' && path === '/contact/info') {
    const row = await first(env.DB, 'SELECT * FROM contact_info WHERE id = ?', 'main');
    return ok(contactInfoFromRow(row));
  }

  if (method === 'POST' && path === '/auth/google-verify') {
    const body = await parseBody(request);
    if (!body.email || !body.name) return fail('email and name are required');
    const email = String(body.email).toLowerCase();
    const existing = await first(env.DB, 'SELECT * FROM admins WHERE lower(email) = ?', email);
    const now = new Date().toISOString();
    if (!existing) {
      await run(env.DB, 'INSERT INTO admins (id, email, name, picture, isActive, lastLogin, createdAt, updatedAt) VALUES (?, ?, ?, ?, 1, ?, ?, ?)', id(), email, body.name, body.picture || null, now, now, now);
    } else {
      await run(env.DB, 'UPDATE admins SET name = ?, picture = COALESCE(?, picture), lastLogin = ?, updatedAt = ? WHERE id = ?', body.name, body.picture || null, now, now, existing.id);
    }
    const admin = normalizeAdmin(await first(env.DB, 'SELECT * FROM admins WHERE lower(email) = ?', email));
    return ok({ ...admin, isAdmin: true }, 'Admin authenticated successfully');
  }

  if (method === 'POST' && path === '/auth/check-admin') {
    const body = await parseBody(request);
    const admin = body.email ? await first(env.DB, 'SELECT id FROM admins WHERE lower(email) = ? AND isActive = 1', String(body.email).toLowerCase()) : null;
    return ok({ isAdmin: Boolean(admin) });
  }

  return null;
};

const handleAdmin = async (request, env, path) => {
  const admin = await requireAdmin(request, env);
  if (!admin) return fail('Unauthorized or not an admin', 403);

  if (request.method === 'POST' && path === '/admin/upload-image') {
    const form = await parseBody(request);
    const file = form.get('image');
    if (!file) return fail('No image file provided');
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);
    return ok({ url: `data:${file.type || 'image/png'};base64,${base64}`, publicId: `cloudflare-local-${Date.now()}` });
  }

  if (path === '/admin/contact-messages' && request.method === 'GET') {
    return ok(await all(env.DB, 'SELECT * FROM contact_messages ORDER BY createdAt DESC'));
  }

  if (path === '/admin/contact-info' && request.method === 'GET') {
    const row = await first(env.DB, 'SELECT * FROM contact_info WHERE id = ?', 'main');
    return ok(contactInfoFromRow(row));
  }

  if (path === '/admin/contact-info' && request.method === 'PUT') {
    const body = await parseBody(request);
    const now = new Date().toISOString();
    await run(
      env.DB,
      `INSERT INTO contact_info (id, phone, email, address, emergencyNumber, facebook, instagram, whatsapp, weekday, weekend, updatedAt)
       VALUES ('main', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET phone = excluded.phone, email = excluded.email, address = excluded.address,
       emergencyNumber = excluded.emergencyNumber, facebook = excluded.facebook, instagram = excluded.instagram,
       whatsapp = excluded.whatsapp, weekday = excluded.weekday, weekend = excluded.weekend, updatedAt = excluded.updatedAt`,
      body.phone || '',
      body.email || '',
      body.address || '',
      body.emergencyNumber || '101',
      body.socialLinks?.facebook || '',
      body.socialLinks?.instagram || '',
      body.socialLinks?.whatsapp || '',
      body.businessHours?.weekday || '08:00 - 18:00',
      body.businessHours?.weekend || '09:00 - 17:00',
      now
    );
    const row = await first(env.DB, 'SELECT * FROM contact_info WHERE id = ?', 'main');
    return ok(contactInfoFromRow(row), 'Contact info updated successfully');
  }

  const match = path.match(/^\/admin\/([^/]+)(?:\/([^/]+))?$/);
  if (!match) return null;
  const [, resource, resourceId] = match;
  const config = tableConfig[resource];
  if (!config) return null;

  if (request.method === 'GET' && !resourceId) {
    const rows = await all(env.DB, config.listSql);
    return ok(config.normalize ? rows.map(config.normalize) : rows);
  }

  if (request.method === 'POST' && !resourceId) {
    const body = await parseBody(request);
    return json({ success: true, data: await createRow(env, config, body), timestamp: new Date().toISOString() }, 201);
  }

  if (request.method === 'PUT' && resourceId) {
    const body = await parseBody(request);
    return ok(await updateRow(env, config, resourceId, body), 'Updated successfully');
  }

  if (request.method === 'DELETE' && resourceId) {
    return deleteRow(env, config, resourceId, admin);
  }

  return null;
};

export async function onRequest(context) {
  const { request, env, params } = context;
  if (request.method === 'OPTIONS') return json({ ok: true });
  if (!env.DB) return fail('Cloudflare D1 binding DB is not configured', 500);
  await ensureSchema(env.DB);

  const pathParts = Array.isArray(params.path) ? params.path : [params.path || ''];
  const path = `/${pathParts.filter(Boolean).join('/')}`;

  try {
    const adminResponse = path.startsWith('/admin/') ? await handleAdmin(request, env, path) : null;
    if (adminResponse) return adminResponse;

    const publicResponse = await handlePublic(request, env, path);
    if (publicResponse) return publicResponse;

    return fail('Route not found', 404);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Internal server error', 500);
  }
}
