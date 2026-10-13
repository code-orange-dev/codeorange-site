// Nostr sign-in (NIP-98 style): the browser signs a short-lived event with the user's
// Nostr key (via an extension or a remote signer) and the server checks the signature.
// BIP-340 Schnorr verification on secp256k1, written out here so the site needs no npm
// dependencies. Verification only: no secret keys ever touch this code.

const crypto = require("node:crypto");

const P = 2n ** 256n - 2n ** 32n - 977n;
const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const G = [
  0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n,
  0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n,
];

const mod = (a, m = P) => ((a % m) + m) % m;
function pow(b, e, m = P) {
  let r = 1n;
  b = mod(b, m);
  for (; e > 0n; e >>= 1n, b = (b * b) % m) if (e & 1n) r = (r * b) % m;
  return r;
}

// Points in Jacobian coordinates [X, Y, Z]; Z = 0 is the point at infinity.
function double([X, Y, Z]) {
  if (Z === 0n || Y === 0n) return [0n, 1n, 0n];
  const S = mod(4n * X * Y * Y);
  const M = mod(3n * X * X);
  const X3 = mod(M * M - 2n * S);
  return [X3, mod(M * (S - X3) - 8n * Y ** 4n), mod(2n * Y * Z)];
}
function add(p, q) {
  if (p[2] === 0n) return q;
  if (q[2] === 0n) return p;
  const [X1, Y1, Z1] = p;
  const [X2, Y2, Z2] = q;
  const Z1Z1 = mod(Z1 * Z1);
  const Z2Z2 = mod(Z2 * Z2);
  const U1 = mod(X1 * Z2Z2);
  const U2 = mod(X2 * Z1Z1);
  const S1 = mod(Y1 * Z2 * Z2Z2);
  const S2 = mod(Y2 * Z1 * Z1Z1);
  if (U1 === U2) return S1 === S2 ? double(p) : [0n, 1n, 0n];
  const H = mod(U2 - U1);
  const R = mod(S2 - S1);
  const HH = mod(H * H);
  const HHH = mod(H * HH);
  const X3 = mod(R * R - HHH - 2n * U1 * HH);
  return [X3, mod(R * (U1 * HH - X3) - S1 * HHH), mod(H * Z1 * Z2)];
}
function mul(point, k) {
  let r = [0n, 1n, 0n];
  for (let q = point; k > 0n; k >>= 1n, q = double(q)) if (k & 1n) r = add(r, q);
  return r;
}
function affine([X, Y, Z]) {
  if (Z === 0n) return null;
  const zi = pow(Z, P - 2n);
  return [mod(X * zi * zi), mod(Y * zi * zi * zi)];
}

const big = (buf) => BigInt(`0x${buf.toString("hex") || "0"}`);
const sha256 = (...parts) => crypto.createHash("sha256").update(Buffer.concat(parts)).digest();
const CHALLENGE = sha256(Buffer.from("BIP0340/challenge"));

// BIP-340: sig (64 bytes) over msg (32 bytes) by x-only public key pub (32 bytes).
function schnorrVerify(sig, msg, pub) {
  const x = big(pub);
  if (x >= P) return false;
  const c = mod(x ** 3n + 7n);
  let y = pow(c, (P + 1n) / 4n);
  if (mod(y * y) !== c) return false;
  if (y & 1n) y = P - y;
  const r = big(sig.subarray(0, 32));
  const s = big(sig.subarray(32, 64));
  if (r >= P || s >= N) return false;
  const e = mod(big(sha256(CHALLENGE, CHALLENGE, sig.subarray(0, 32), pub, msg)), N);
  const R = affine(add(mul([G[0], G[1], 1n], s), mul([x, y, 1n], N - e)));
  return !!R && (R[1] & 1n) === 0n && R[0] === r;
}

const HEX64 = /^[0-9a-f]{64}$/;
const HEX128 = /^[0-9a-f]{128}$/;

// Checks a signed kind-27235 event made for this API (url and method tags), no older
// than maxAge seconds. Returns the signer's hex public key, or "" if anything is off.
function verifyAuthEvent(ev, url, maxAge = 300) {
  if (!ev || typeof ev !== "object") return "";
  const { id, pubkey, created_at, kind, tags, content, sig } = ev;
  if (kind !== 27235 || !HEX64.test(id || "") || !HEX64.test(pubkey || "") || !HEX128.test(sig || "")) return "";
  if (!Number.isInteger(created_at) || Math.abs(Date.now() / 1000 - created_at) > maxAge) return "";
  if (!Array.isArray(tags) || tags.length > 10 || typeof content !== "string" || content.length > 500) return "";
  const tag = (name) => tags.find((t) => Array.isArray(t) && t[0] === name)?.[1];
  if (tag("u") !== url || tag("method") !== "POST") return "";
  const serial = JSON.stringify([0, pubkey, created_at, kind, tags, content]);
  if (sha256(Buffer.from(serial)).toString("hex") !== id) return "";
  return schnorrVerify(Buffer.from(sig, "hex"), Buffer.from(id, "hex"), Buffer.from(pubkey, "hex")) ? pubkey : "";
}

module.exports = { schnorrVerify, verifyAuthEvent };
