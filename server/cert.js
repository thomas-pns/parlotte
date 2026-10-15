'use strict';
// Génère un certificat HTTPS auto-signé (X.509 v3, RSA 2048 / SHA-256) sans aucun outil externe.
// Nécessaire car les navigateurs n'autorisent le micro (vocal) que sur une page sécurisée.
const crypto = require('crypto');

// --- Encodage ASN.1 DER minimal
function len(n) {
  if (n < 128) return Buffer.from([n]);
  const bytes = []; while (n > 0) { bytes.unshift(n & 255); n >>= 8; }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}
const tlv = (tag, body) => Buffer.concat([Buffer.from([tag]), len(body.length), body]);
const seq = (...items) => tlv(0x30, Buffer.concat(items));
const set = (...items) => tlv(0x31, Buffer.concat(items));
const int = buf => tlv(0x02, buf[0] & 0x80 ? Buffer.concat([Buffer.from([0]), buf]) : buf);
const nul = () => Buffer.from([0x05, 0x00]);
const octet = buf => tlv(0x04, buf);
const bitString = buf => tlv(0x03, Buffer.concat([Buffer.from([0]), buf]));
const utf8 = s => tlv(0x0c, Buffer.from(s, 'utf8'));
const explicit = (n, body) => tlv(0xa0 + n, body);
const bool = v => Buffer.from([0x01, 0x01, v ? 0xff : 0x00]);
function oid(str) {
  const p = str.split('.').map(Number), out = [40 * p[0] + p[1]];
  for (const v of p.slice(2)) {
    const b = [v & 0x7f]; let x = v >> 7;
    while (x > 0) { b.unshift((x & 0x7f) | 0x80); x >>= 7; }
    out.push(...b);
  }
  return tlv(0x06, Buffer.from(out));
}
function time(d) { // UTCTime AAMMJJHHMMSSZ
  const p = n => String(n).padStart(2, '0');
  return tlv(0x17, Buffer.from(`${p(d.getUTCFullYear() % 100)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`));
}
function ipBytes(ip) {
  if (ip.includes(':')) return null; // IPv6 ignoré pour rester simple
  return Buffer.from(ip.split('.').map(Number));
}

function generateCertificate({ commonName = 'Parlotte', dnsNames = ['localhost'], ips = ['127.0.0.1'], days = 397 } = {}) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const spki = publicKey.export({ type: 'spki', format: 'der' });
  const sha256WithRSA = seq(oid('1.2.840.113549.1.1.11'), nul());
  const name = seq(set(seq(oid('2.5.4.3'), utf8(commonName))));
  const notBefore = new Date(Date.now() - 864e5), notAfter = new Date(Date.now() + days * 864e5);
  const altNames = seq(
    ...dnsNames.map(d => tlv(0x82, Buffer.from(d, 'ascii'))),      // [2] dNSName
    ...ips.map(ipBytes).filter(Boolean).map(b => tlv(0x87, b)));  // [7] iPAddress
  const extensions = seq(
    seq(oid('2.5.29.19'), bool(true), octet(seq())),                          // basicConstraints : pas une autorité
    seq(oid('2.5.29.15'), bool(true), octet(Buffer.from([0x03, 0x02, 0x05, 0xa0]))), // keyUsage : signature + chiffrement de clé
    seq(oid('2.5.29.37'), octet(seq(oid('1.3.6.1.5.5.7.3.1')))),              // extendedKeyUsage : serveur TLS
    seq(oid('2.5.29.17'), octet(altNames)));                                  // subjectAltName
  // Numéro de série positif sans octet nul en tête (sinon encodage DER invalide « illegal padding »).
  const serial = crypto.randomBytes(16); serial[0] = 0x40 | (serial[0] & 0x3f);
  const tbs = seq(explicit(0, int(Buffer.from([2]))), int(serial), sha256WithRSA, name,
    seq(time(notBefore), time(notAfter)), name, spki, explicit(3, extensions));
  const signature = crypto.sign('sha256', tbs, privateKey);
  const der = seq(tbs, sha256WithRSA, bitString(signature));
  const pem = (label, buf) => `-----BEGIN ${label}-----\n${buf.toString('base64').match(/.{1,64}/g).join('\n')}\n-----END ${label}-----\n`;
  return { cert: pem('CERTIFICATE', der), key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
}

module.exports = { generateCertificate };
