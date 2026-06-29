// evaluation/measure-gas.js
// Trade-off study: issuance gas for the hash-anchored design (CredentialRegistry)
// vs. the full-record-on-chain baseline (NaiveCredentialRegistry).
// Both contracts issue the SAME Jane credential, read from offchain/credential-jane.json,
// so the only variable is the storage strategy. All numbers are real gasUsed values
// from transaction receipts on a local Hardhat node. Nothing is hardcoded.

const path = require("path");
const fs = require("fs");
const { ethers } = require("hardhat");
const { credentialId } = require("../offchain/hashRecord");

function pct(extra, base) {
  return ((Number(extra) / Number(base)) * 100).toFixed(1);
}

async function main() {
  const [admin, university, student] = await ethers.getSigners();

  // The shared credential id, recomputed from the real off-chain record.
  const recordPath = path.join(__dirname, "..", "offchain", "credential-jane.json");
  const id = credentialId(recordPath);
  const rec = JSON.parse(fs.readFileSync(recordPath, "utf8"));

  // ---- Anchored design: store only the keccak256 anchor + a pointer ----
  const Anchored = await ethers.getContractFactory("CredentialRegistry", admin);
  const anchored = await Anchored.deploy();
  await anchored.waitForDeployment();
  const anchoredDeploy = (await anchored.deploymentTransaction().wait()).gasUsed;
  await (await anchored.connect(admin).addIssuer(university.address, "University of Toronto")).wait();
  const META = "ipfs://bafkreigh2akiscaildc...example";
  const aRcpt = await (await anchored.connect(university)
    .issueCredential(id, student.address, META)).wait();
  const anchoredIssue = aRcpt.gasUsed;

  // ---- Naive design: store the FULL record on-chain (the anti-pattern) ----
  const Naive = await ethers.getContractFactory("NaiveCredentialRegistry", admin);
  const naive = await Naive.deploy();
  await naive.waitForDeployment();
  const naiveDeploy = (await naive.deploymentTransaction().wait()).gasUsed;
  await (await naive.connect(admin).addIssuer(university.address)).wait();
  // Map the same Jane record into the naive contract's six string fields.
  const record = {
    studentName: rec.holder.name,
    program: rec.credential.program,
    gpa: rec.credential.gpa,
    conferredDate: rec.credential.conferredDate,
    institution: rec.issuer.name,
    transcriptDigest: rec.credential.transcriptDigest,
  };
  const nRcpt = await (await naive.connect(university)
    .issueCredential(id, student.address, record)).wait();
  const naiveIssue = nRcpt.gasUsed;

  // ---- Report ----
  const issueDelta = naiveIssue - anchoredIssue;
  const deployDelta = naiveDeploy - anchoredDeploy;

  const bar = "=".repeat(64);
  console.log(bar);
  console.log("CredChain storage trade-off: hash-anchored vs full-record-on-chain");
  console.log("Same Jane credential issued on both. Units = gas (real gasUsed).");
  console.log(bar);
  console.log("Credential id:", id);
  console.log("");
  console.log("ISSUANCE gas (the headline operation):");
  console.log("  Anchored (CredentialRegistry)      :", anchoredIssue.toString());
  console.log("  Naive    (NaiveCredentialRegistry) :", naiveIssue.toString());
  console.log("  Extra gas for naive                :", issueDelta.toString());
  console.log("  Naive overhead vs anchored         : +" + pct(issueDelta, anchoredIssue) + "%");
  console.log("  Anchored as share of naive         : " +
    ((Number(anchoredIssue) / Number(naiveIssue)) * 100).toFixed(1) + "%");
  console.log("");
  console.log("DEPLOYMENT gas (one-time, for completeness):");
  console.log("  Anchored :", anchoredDeploy.toString());
  console.log("  Naive    :", naiveDeploy.toString());
  console.log("  Delta    :", deployDelta.toString());
  console.log(bar);
  console.log("Note: the naive contract ALSO writes student name, program, GPA, and");
  console.log("dates to the public chain in cleartext -- a privacy cost the gas number");
  console.log("alone does not capture. The anchored design writes only the hash.");
  console.log(bar);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
