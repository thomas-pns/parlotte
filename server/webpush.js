'use strict';
// Notifications « push » (Web Push) sans aucune dépendance : ce qui fait sonner un téléphone même
// quand Parlotte est fermé. Implémente RFC 8291 (chiffrement aes128gcm) et RFC 8292 (VAPID).
// Le message part du PC qui héberge vers le service de push du téléphone (Apple, Google, Mozilla).
const crypto = require('crypto');

const b64u = buf => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

// Clés VAPID (identité de ce serveur auprès des services de push), créées une fois et gardées
function makeVapid() {
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
  return { publicKey: b64u(ecdh.getPublicKey()), privateKey: b64u(ecdh.getPrivateKey()) };
}
function vapidKeyObject(v) {
  const pub = unb64u(v.publicKey);
  return crypto.createPrivateKey({ key: { kty: 'EC', crv: 'P-256', d: v.privateKey, x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) }, format: 'jwk' });
}
function vapidHeader(v, endpoint, subject) {
  const aud = new URL(endpoint).origin;
  const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const body = b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject }));
  const sig = crypto.sign('sha256', Buffer.from(`${head}.${body}`), { key: vapidKeyObject(v), dsaEncoding: 'ieee-p1363' });
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${v.publicKey}`;
}

// Chiffrement du contenu pour un abonnement { endpoint, keys: { p256dh, auth } }
function encrypt(sub, payload) {
  const uaPublic = unb64u(sub.keys.p256dh), authSecret = unb64u(sub.keys.auth);
  const as = crypto.createECDH('prime256v1'); as.generateKeys();
  const asPublic = as.getPublicKey(), shared = as.computeSecret(uaPublic);
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', shared, authSecret, keyInfo, 32));
  const salt = crypto.randomBytes(16);
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const c = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const body = Buffer.concat([c.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const header = Buffer.alloc(21); salt.copy(header, 0); header.writeUInt32BE(4096, 16); header[20] = asPublic.length;
  return Buffer.concat([header, asPublic, body]);
}

// Envoie ; renvoie le code HTTP (404 / 410 = abonnement mort, à oublier)
async function sendPush(v, sub, data, { subject = 'https://github.com/thomas-pns/parlotte', ttl = 86400, urgency = 'high', topic } = {}) {
  const body = encrypt(sub, JSON.stringify(data));
  const headers = { 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: String(ttl), Urgency: urgency, Authorization: vapidHeader(v, sub.endpoint, subject) };
  if (topic) headers.Topic = String(topic).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32);
  const r = await fetch(sub.endpoint, { method: 'POST', headers, body });
  return r.status;
}

// Pour les tests : déchiffrer comme le ferait le téléphone
function decryptForTest(uaEcdh, authSecret, buf) {
  const salt = buf.subarray(0, 16), idlen = buf[20], asPublic = buf.subarray(21, 21 + idlen), ct = buf.subarray(21 + idlen);
  const shared = uaEcdh.computeSecret(asPublic), uaPublic = uaEcdh.getPublicKey();
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', shared, authSecret, keyInfo, 32));
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const d = crypto.createDecipheriv('aes-128-gcm', cek, nonce); d.setAuthTag(ct.subarray(ct.length - 16));
  const plain = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  return plain.subarray(0, plain.lastIndexOf(2)).toString();
}

module.exports = { makeVapid, vapidHeader, encrypt, sendPush, decryptForTest, b64u, unb64u };
