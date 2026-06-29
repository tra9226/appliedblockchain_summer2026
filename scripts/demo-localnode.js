// scripts/demo-localnode.js
// End-to-end CredChain walkthrough against a live local Hardhat node.
// Deploys CredentialRegistry and exercises the full lifecycle with FOUR
// accounts, one per role: admin, issuer (university), holder (student),
// verifier (employer). The credential id is recomputed from the off-chain
// JSON at runtime -- never hardcoded.

const path = require("path");
const { ethers } = require("hardhat");
const { credentialId } = require("../offchain/hashRecord");

function line() { console.log("-".repeat(72)); }

async function main() {
  const [admin, university, student, employer] = await ethers.getSigners();

  console.log("CredChain local-node walkthrough");
  line();
  console.log("Accounts (one per modeled role):");
  console.log("  admin / registrar :", admin.address);
  console.log("  issuer / univ.    :", university.address);
  console.log("  holder / student  :", student.address);
  console.log("  verifier / empl.  :", employer.address);
  line();

  const Registry = await ethers.getContractFactory("CredentialRegistry", admin);
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  const addr = await registry.getAddress();
  console.log("[1] Deployed CredentialRegistry at:", addr);
  console.log("    on-chain admin():", await registry.admin());

  const META = "ipfs://bafkreigh2akiscaildc...example";
  let tx = await registry.connect(admin).addIssuer(university.address, "University of Toronto");
  await tx.wait();
  console.log("[2] admin.addIssuer(university) -> isIssuer:",
    await registry.isIssuer(university.address));

  const id = credentialId(path.join(__dirname, "..", "offchain", "credential-jane.json"));
  console.log("[3] credential id recomputed from credential-jane.json:");
  console.log("   ", id);

  tx = await registry.connect(university).issueCredential(id, student.address, META);
  let rcpt = await tx.wait();
  console.log("[4] university.issueCredential(...) mined in block", rcpt.blockNumber);
  console.log("    issuance gasUsed:", rcpt.gasUsed.toString());

  const v = await registry.verifyCredential(id);
  console.log("[5] verifyCredential(id) ->");
  console.log("    exists:", v.exists, "| status:", v.status.toString(),
    "(1=Active) | issuer:", v.issuer, "| holder:", v.holder);

  try {
    await registry.connect(employer).getMetadataURI(id);
    console.log("[6] UNEXPECTED: employer read pointer without access");
  } catch (e) {
    console.log("[6] employer.getMetadataURI(id) correctly reverted:",
      (e.shortMessage || e.message).replace(/\n/g, " "));
  }

  tx = await registry.connect(student).grantAccess(id, employer.address);
  await tx.wait();
  const uri = await registry.connect(employer).getMetadataURI(id);
  console.log("[7] student.grantAccess(employer) -> employer reads pointer:", uri);

  tx = await registry.connect(university).revokeCredential(id);
  await tx.wait();
  console.log("[8] university.revokeCredential(id) -> isValid:",
    await registry.isValid(id), "(false = revoked)");

  line();
  console.log("Walkthrough complete: deploy -> authorize -> issue -> verify ->");
  console.log("access-gate -> grant -> revoke. All four roles exercised on a live node.");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
