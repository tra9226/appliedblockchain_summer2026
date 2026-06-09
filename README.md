## CredChain — Hash-Anchored Academic Credential Registry 

### A proof-of-concept system for issuing and verifying academic credentials (diplomas, transcripts) on an Ethereum-compatible blockchain. Only a keccak256 anchor and minimal status metadata are stored on-chain; the full credential record stays off-chain. This README lets you reproduce the build, the tests, and the demo from a clean machine.

## 1. Prerequisites
Node.js 18 or newer (developed on Node 22). Check with node --version.
npm (ships with Node).
No global installs are required — everything is local to the project.

## 2. Setup
get into the project folder (where this README lives) and then npm 
npm install
If npm reports a peer-dependency (ERESOLVE) error, re-run with:

        npm install --legacy-peer-deps

## 3. Project structure
credchain/

├── contracts/

│   ├── CredentialRegistry.sol        # main contract (the submission)

│   └── NaiveCredentialRegistry.sol   # baseline for the gas trade-off study

├── test/

│   └── CredentialRegistry.test.js    # 14 automated tests

├── offchain/

│   ├── credential-jane.json          # sample off-chain credential record

│   └── hashRecord.js                 # computes credential id = keccak256(record)

├── hardhat.config.js

├── package.json

└── README.md

## 4. Compile the contracts
npx hardhat compile

        Expected: Compiled 2 Solidity files successfully. The first run downloads the solc 0.8.24 compiler automatically.


## 5. Run the Tests
Expected output (14 passing):

  CredentialRegistry

    Issuer management (admin role)

      ✓ admin can authorize an issuer

      ✓ non-admin cannot authorize an issuer

      ✓ admin can remove an issuer

    Issuing credentials (issuer role)

      ✓ authorized issuer can issue a credential

      ✓ unauthorized account cannot issue (fake issuer threat)

      ✓ cannot issue the same credential id twice (replay/duplicate)

    Revocation

      ✓ issuing issuer can revoke

      ✓ a DIFFERENT issuer cannot revoke someone else's credential

      ✓ cannot revoke an already-revoked credential

    Holder-controlled access (privacy)

      ✓ verifier without access cannot read the metadata pointer

      ✓ holder grants access, then verifier can read the pointer

      ✓ only the holder can grant access (broken-access-control guard)

      ✓ holder can revoke a verifier's access

    Public verification of a non-existent credential

      ✓ returns exists=false for an unknown id

  14 passing

### The tests cover the full credential lifecycle and the adversarial cases that back the security analysis: fake issuers, duplicate/replay issuance, unauthorized revocation, and broken access control.

## 6. Reproduce the off-chain → on-chain link
The on-chain credential id is the keccak256 hash of the canonicalized off-chain JSON record. Compute it for the sample file:

node offchain/hashRecord.js

Expected:

File: .../offchain/credential-jane.json

Credential id: 0x859b3956b636b8ecabab72681f45e8925a37d396b87aa482ea2dc8a112967269

This id is what an issuer passes to issueCredential, and what a verifier recomputes from a received file to confirm it matches the on-chain anchor.

## 7. (Optional) Deploy to a local network 

Start a local Hardhat node in one terminal:

npx hardhat node

It prints 20 funded test accounts. Use account #0 as admin, #1 as the issuer, #2 as the student/holder, #3 as the verifier. Deploy and interact via npx hardhat console --network localhost or a deploy script.

## 8. Manual test plan (fallback if automation is unavailable)

In Remix (https://remix.ethereum.org) using the in-browser VM:

Deploy CredentialRegistry from account A (becomes admin).
From A, call addIssuer(B, "University of Toronto").
From B, call issueCredential(<id>, C, "ipfs://...") where <id> is the output of step 6.
From any account, call verifyCredential(<id>) → returns issuer B, holder C, status Active.
From C, call grantAccess(<id>, D); from D, call getMetadataURI(<id>) → returns the pointer. From any other account it reverts with Access denied.
From B, call revokeCredential(<id>); isValid(<id>) now returns false.

Each step has a corresponding automated test in Section 5.

##Thank you for following!## 



