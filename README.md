# DxtSignatureTool

DxtSignatureTool provides signing and verification capabilities for `.dxt` (or other custom extension) packages. Inspired by Android APK Signature Scheme V3, it ensures package integrity, publisher authentication, and seamless **key rotation**.

---

## ✨ Features

* Computes a SHA-256 digest of the entire `.dxt` ZIP (excluding the signature file) and signs/verifies it.
* Supports multiple algorithms (default `SHA256withRSA`; easily extendable to ECDSA P-256, etc.).
* Maintains a list of signature records. Installers verify from newest → oldest, enabling built-in key rotation.
* Trust can be established via a local `trustedPublicKeys` whitelist or the embedded `certificate` field.
* Friendly CLI — one command to sign, one to verify.

---

## 📦 Signature layout
The signature information lives at the fixed path `META-INF/dxt-signatures.json` inside the ZIP:

```json
{
  "signatures": [
    {
      "version": 1,
      "signingKeyId": "abc123",           // Publisher key identifier
      "algorithm": "SHA256withRSA",
      "signature": "base64-encoded-sig",
      "certificate": "base64-encoded-PEM", // optional
      "timestamp": 1719453678
    }
  ],
  "signedPayload": {
    "digestAlgorithm": "SHA-256",
    "digest": "sha256-of-entire-dxt-zip-excluding-this-signature",
    "dxtVersion": "1.0.0",
    "manifestDigest": "sha256(manifest.json)"
  }
}
```

**Notes**
1. `signatures` MAY contain multiple records; an installer should verify the last (most recent) one first.
2. `signedPayload.digest` is calculated over every ZIP entry except `dxt-signatures.json`.
3. `manifestDigest` defends against inline tampering (re-compute and compare during installation).

---

## 🔏 Signing workflow
1. Read the original `.dxt` and ignore any existing `META-INF/dxt-signatures.json`.
2. Compute a SHA-256 digest of the remaining content.
3. Sign the digest with the private key to obtain the `signature` field.
4. Assemble `dxt-signatures.json` and write it under `META-INF/`.

CLI example:
```bash
node dxt_signature_tool.js sign ./your.dxt ./private_key.pem abc123 ./output.dxt
```

---

## ✅ Verification workflow
1. Parse `META-INF/dxt-signatures.json`.
2. Pick the last entry from `signatures` (or iterate through all if needed).
3. Locate the public key matching `signingKeyId` in your local **trustedPublicKeys** list, or use the embedded `certificate`.
4. Verify that the `signature` matches the digest.
5. Re-compute the SHA-256 of the `.dxt` (excluding `dxt-signatures.json`) and ensure it equals `signedPayload.digest`.
6. (Optional) Verify the `manifest.json` hash.

CLI example:
```bash
node dxt_signature_tool.js verify ./output.dxt abc123 ./public_key.pem
```

---

## 🔁 Key rotation
When a key needs to be replaced:

1. Generate a new key pair and derive its `signingKeyId` (e.g., SHA-256 fingerprint of the public key).
2. Run `sign` using the **new private key** — the tool will append/replace an entry in `signatures`.
3. Update the installer's trust list:

```json
{
  "trustedSigners": {
    "abc123": "My Company Old Key",
    "def456": "My Company New Key 2025"
  }
}
```

Old packages still validate with `abc123`; new releases use `def456`.

---

## 🛠️ Installation & dependencies

```bash
# Clone the repository
git clone <repo-url> && cd DxtSignatureTool

# Install dependencies
npm install
```

Dependencies (see `package.json`):
* `adm-zip` – ZIP read/write
* Node.js built-ins: `crypto`, `fs`, `path`

---

## 🧩 Typical .dxt structure

```text
my_extension.dxt (ZIP)
├── manifest.json
├── main.js
├── assets/
└── META-INF/
    └── dxt-signatures.json
```

---

## 🔒 Security tips
* Prefer **ECDSA P-256 + SHA-256** for shorter and faster signatures.
* Include a timestamp in `dxt-signatures.json`; installers can enforce expiry windows or integrate with a TSA.
* Combine with OCSP/CRL or an online API for key revocation.
* Add a `publisher` field inside `manifest.json` to display and compare with the signature identity.

---

## License
MIT
