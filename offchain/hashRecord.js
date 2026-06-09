// Computes the credential id = keccak256(canonical JSON bytes).
// This is the integrity link between the off-chain file and the on-chain anchor.
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

function canonicalize(obj) {
  // Deterministic JSON: sort keys recursively so the same record always hashes
  // to the same id regardless of key ordering / whitespace.
  if (Array.isArray(obj)) return obj.map(canonicalize);
  if (obj && typeof obj === "object") {
    return Object.keys(obj)
      .sort()
      .reduce((acc, k) => {
        acc[k] = canonicalize(obj[k]);
        return acc;
      }, {});
  }
  return obj;
}

function credentialId(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const canonical = JSON.stringify(canonicalize(raw));
  return ethers.keccak256(ethers.toUtf8Bytes(canonical));
}

if (require.main === module) {
  const file = process.argv[2] || path.join(__dirname, "credential-jane.json");
  console.log("File:", file);
  console.log("Credential id:", credentialId(file));
}

module.exports = { credentialId, canonicalize };
