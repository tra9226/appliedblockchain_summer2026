// evaluation/measure-gas-by-size.js
// Record-size sweep for the storage trade-off study.
// Shows that hash-anchored issuance gas is (essentially) CONSTANT regardless of
// credential record size -- because only a fixed 32-byte keccak256 hash is stored
// on-chain -- while full-record issuance gas GROWS with the record, since every
// field is written to storage at SSTORE rates. Records vary by transcript length
// (number of courses). All numbers are real gasUsed values from receipts.

const { ethers } = require("hardhat");

// A transcript with `n` course lines (each line ~60 bytes of realistic text).
function transcript(n) {
  const rows = [];
  for (let i = 1; i <= n; i++) {
    const code = "CSC" + String(200 + i);
    rows.push(`${code}: Advanced Topics in Computing ${i} - Grade A (1.0 credit)`);
  }
  return rows.join("; ");
}

// The full off-chain record: what the hash covers, and what the naive contract stores.
function buildRecord(n) {
  return {
    studentName: "Jane Q. Student",
    program: "BSc Computer Science",
    gpa: "3.91",
    conferredDate: "2025-06-15",
    institution: "University of Toronto",
    transcriptDigest: transcript(n), // the part that grows with record size
  };
}

async function main() {
  const [admin, university, student] = await ethers.getSigners();
  const META = "ipfs://bafkreigh2akiscaildc...example";
  const sizes = [1, 5, 10, 20, 40]; // courses on the transcript

  const Anchored = await ethers.getContractFactory("CredentialRegistry", admin);
  const anchored = await Anchored.deploy(); await anchored.waitForDeployment();
  await (await anchored.connect(admin).addIssuer(university.address, "University of Toronto")).wait();

  const Naive = await ethers.getContractFactory("NaiveCredentialRegistry", admin);
  const naive = await Naive.deploy(); await naive.waitForDeployment();
  await (await naive.connect(admin).addIssuer(university.address, "University of Toronto")).wait();

  const rows = [];
  for (const n of sizes) {
    const rec = buildRecord(n);
    const bytes = ethers.toUtf8Bytes(JSON.stringify(rec)).length;

    // Anchored: id = keccak256(record) -> 32 bytes -> stored as the key. Record stays off-chain.
    const id = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(rec)));
    const aGas = (await (await anchored.connect(university)
      .issueCredential(id, student.address, META)).wait()).gasUsed;

    // Full-record: store the entire record on-chain (unique id to avoid "already issued").
    const nId = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(rec) + "#naive"));
    const nGas = (await (await naive.connect(university)
      .issueCredential(nId, student.address, META, rec)).wait()).gasUsed;

    rows.push({ n, bytes, aGas, nGas });
  }

  const bar = "=".repeat(74);
  console.log(bar);
  console.log("CredChain record-size sweep: issuance gas vs credential record size");
  console.log("Anchored = fixed 32-byte hash on-chain; Full-record = whole record on-chain");
  console.log(bar);
  console.log("courses | record bytes | anchored gas | full-record gas | naive / anchored");
  console.log("-".repeat(74));
  for (const r of rows) {
    const ratio = (Number(r.nGas) / Number(r.aGas)).toFixed(2);
    console.log(
      String(r.n).padStart(7) + " | " +
      String(r.bytes).padStart(12) + " | " +
      r.aGas.toString().padStart(12) + " | " +
      r.nGas.toString().padStart(15) + " | " +
      (ratio + "x").padStart(16)
    );
  }
  console.log(bar);
  console.log("CSV");
  console.log("courses,record_bytes,anchored_gas,full_record_gas");
  for (const r of rows) console.log(`${r.n},${r.bytes},${r.aGas},${r.nGas}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
