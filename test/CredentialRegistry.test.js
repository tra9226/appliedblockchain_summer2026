const { expect } = require("chai");
const { ethers } = require("hardhat");
const { credentialId } = require("../offchain/hashRecord");
const path = require("path");

const Status = { None: 0n, Active: 1n, Revoked: 2n };

describe("CredentialRegistry", function () {
  let registry;
  let admin, university, otherUni, student, employer, stranger;
  let id;
  const META = "ipfs://bafkreigh2akiscaildc...example";

  beforeEach(async function () {
    [admin, university, otherUni, student, employer, stranger] =
      await ethers.getSigners();
    const Registry = await ethers.getContractFactory("CredentialRegistry");
    registry = await Registry.deploy();
    await registry.waitForDeployment();
    // id derived from the real off-chain sample file
    id = credentialId(path.join(__dirname, "../offchain/credential-jane.json"));
  });

  describe("Issuer management (admin role)", function () {
    it("admin can authorize an issuer", async function () {
      await expect(registry.addIssuer(university.address, "University of Toronto"))
        .to.emit(registry, "IssuerAdded")
        .withArgs(university.address, "University of Toronto");
      expect(await registry.isIssuer(university.address)).to.equal(true);
    });

    it("non-admin cannot authorize an issuer", async function () {
      await expect(
        registry.connect(stranger).addIssuer(university.address, "Fake U")
      ).to.be.revertedWith("Not admin");
    });

    it("admin can remove an issuer", async function () {
      await registry.addIssuer(university.address, "UofT");
      await expect(registry.removeIssuer(university.address))
        .to.emit(registry, "IssuerRemoved")
        .withArgs(university.address);
      expect(await registry.isIssuer(university.address)).to.equal(false);
    });
  });

  describe("Issuing credentials (issuer role)", function () {
    beforeEach(async function () {
      await registry.addIssuer(university.address, "UofT");
    });

    it("authorized issuer can issue a credential", async function () {
      await expect(
        registry.connect(university).issueCredential(id, student.address, META)
      )
        .to.emit(registry, "CredentialIssued")
        .withArgs(id, university.address, student.address, anyUint());

      const v = await registry.verifyCredential(id);
      expect(v.exists).to.equal(true);
      expect(v.issuer).to.equal(university.address);
      expect(v.holder).to.equal(student.address);
      expect(v.status).to.equal(Status.Active);
    });

    it("unauthorized account cannot issue (fake issuer threat)", async function () {
      await expect(
        registry.connect(stranger).issueCredential(id, student.address, META)
      ).to.be.revertedWith("Not authorized issuer");
    });

    it("cannot issue the same credential id twice (replay/duplicate)", async function () {
      await registry.connect(university).issueCredential(id, student.address, META);
      await expect(
        registry.connect(university).issueCredential(id, student.address, META)
      ).to.be.revertedWith("Already issued");
    });
  });

  describe("Revocation", function () {
    beforeEach(async function () {
      await registry.addIssuer(university.address, "UofT");
      await registry.addIssuer(otherUni.address, "Other U");
      await registry.connect(university).issueCredential(id, student.address, META);
    });

    it("issuing issuer can revoke", async function () {
      await expect(registry.connect(university).revokeCredential(id))
        .to.emit(registry, "CredentialRevoked");
      expect(await registry.isValid(id)).to.equal(false);
      const v = await registry.verifyCredential(id);
      expect(v.status).to.equal(Status.Revoked);
    });

    it("a DIFFERENT issuer cannot revoke someone else's credential", async function () {
      await expect(
        registry.connect(otherUni).revokeCredential(id)
      ).to.be.revertedWith("Not issuing issuer");
    });

    it("cannot revoke an already-revoked credential", async function () {
      await registry.connect(university).revokeCredential(id);
      await expect(
        registry.connect(university).revokeCredential(id)
      ).to.be.revertedWith("Not active");
    });
  });

  describe("Holder-controlled access (privacy)", function () {
    beforeEach(async function () {
      await registry.addIssuer(university.address, "UofT");
      await registry.connect(university).issueCredential(id, student.address, META);
    });

    it("verifier without access cannot read the metadata pointer", async function () {
      await expect(
        registry.connect(employer).getMetadataURI(id)
      ).to.be.revertedWith("Access denied");
    });

    it("holder grants access, then verifier can read the pointer", async function () {
      await expect(registry.connect(student).grantAccess(id, employer.address))
        .to.emit(registry, "AccessGranted")
        .withArgs(id, student.address, employer.address);
      expect(await registry.connect(employer).getMetadataURI(id)).to.equal(META);
    });

    it("only the holder can grant access (broken-access-control guard)", async function () {
      await expect(
        registry.connect(stranger).grantAccess(id, employer.address)
      ).to.be.revertedWith("Not credential holder");
    });

    it("holder can revoke a verifier's access", async function () {
      await registry.connect(student).grantAccess(id, employer.address);
      await registry.connect(student).revokeAccess(id, employer.address);
      expect(await registry.hasAccess(id, employer.address)).to.equal(false);
      await expect(
        registry.connect(employer).getMetadataURI(id)
      ).to.be.revertedWith("Access denied");
    });
  });

  describe("Public verification of a non-existent credential", function () {
    it("returns exists=false for an unknown id", async function () {
      const fakeId = ethers.keccak256(ethers.toUtf8Bytes("not-a-real-record"));
      const v = await registry.verifyCredential(fakeId);
      expect(v.exists).to.equal(false);
      expect(v.status).to.equal(Status.None);
    });
  });
});

// helper matcher for the uint64 timestamp arg
function anyUint() {
  const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
  return anyValue;
}
