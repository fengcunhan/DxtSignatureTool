// dxt_signature_tool.js

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const AdmZip = require('adm-zip');

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function signPayload(privateKeyPem, payloadHashHex) {
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(Buffer.from(payloadHashHex, 'utf-8'));
  return sign.sign(privateKeyPem).toString('base64');
}

function verifySignature(publicKeyPem, payloadHashHex, signatureBase64) {
  const verify = crypto.createVerify('RSA-SHA256');
  verify.update(Buffer.from(payloadHashHex, 'utf-8'));
  return verify.verify(publicKeyPem, Buffer.from(signatureBase64, 'base64'));
}

function extractSignature(zip) {
  const entry = zip.getEntry('META-INF/dxt-signatures.json');
  if (!entry) throw new Error('Signature file not found in META-INF');
  const content = zip.readAsText(entry);
  return JSON.parse(content);
}

function calculatePayloadHash(zip) {
  const zipEntries = zip.getEntries().filter(e => e.entryName !== 'META-INF/dxt-signatures.json');
  const buffers = zipEntries.map(e => zip.readFile(e));
  const combined = Buffer.concat(buffers);
  return sha256(combined);
}

function verifyDxt(dxtPath, trustedPublicKeysMap) {
  const zip = new AdmZip(dxtPath);
  const signatureData = extractSignature(zip);
  const latestSig = signatureData.signatures.slice(-1)[0];

  const payloadHash = calculatePayloadHash(zip);
  if (payloadHash !== signatureData.signedPayload.digest) {
    throw new Error('Payload digest mismatch');
  }

  const keyId = latestSig.signingKeyId;
  const publicKeyPem = trustedPublicKeysMap[keyId];
  if (!publicKeyPem) {
    throw new Error(`Untrusted key ID: ${keyId}`);
  }

  const isValid = verifySignature(publicKeyPem, payloadHash, latestSig.signature);
  if (!isValid) {
    throw new Error('Signature verification failed');
  }

  console.log('DXT signature verification successful.');
}

function signDxt(dxtPath, privateKeyPath, keyId, outPath) {
  const privateKeyPem = fs.readFileSync(privateKeyPath, 'utf-8');
  const zip = new AdmZip(dxtPath);

  const payloadHash = calculatePayloadHash(zip);
  const signature = signPayload(privateKeyPem, payloadHash);

  const signedPayload = {
    digestAlgorithm: "SHA-256",
    digest: payloadHash,
    dxtVersion: "1.0.0",
    manifestDigest: sha256(zip.readAsText("manifest.json"))
  };

  const signatureData = {
    signatures: [
      {
        version: 1,
        signingKeyId: keyId,
        algorithm: "SHA256withRSA",
        signature,
        certificate: "", // 可选留空或填入 base64 证书
        timestamp: Math.floor(Date.now() / 1000)
      }
    ],
    signedPayload
  };

  zip.addFile("META-INF/dxt-signatures.json", Buffer.from(JSON.stringify(signatureData, null, 2)));
  zip.writeZip(outPath);
  console.log("DXT signed and written to:", outPath);
}

// Example usage:
if (require.main === module) {
  const cmd = process.argv[2];

  if (cmd === 'verify') {
    const dxtPath = process.argv[3];
    const keyId = process.argv[4];
    const pubKeyPath = process.argv[5];
    const trustedKeys = {
      [keyId]: fs.readFileSync(pubKeyPath, 'utf-8'),
    };
    try {
      verifyDxt(dxtPath, trustedKeys);
    } catch (e) {
      console.error('Verification failed:', e.message);
    }
  } else if (cmd === 'sign') {
    const dxtPath = process.argv[3];
    const privKeyPath = process.argv[4];
    const keyId = process.argv[5];
    const outPath = process.argv[6];
    signDxt(dxtPath, privKeyPath, keyId, outPath);
  } else {
    console.log("Usage:");
    console.log("  node dxt_signature_tool.js verify <dxtPath> <keyId> <publicKeyPath>");
    console.log("  node dxt_signature_tool.js sign <dxtPath> <privateKeyPath> <keyId> <outPath>");
  }
}