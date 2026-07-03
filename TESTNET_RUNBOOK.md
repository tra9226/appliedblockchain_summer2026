# CredChain — Sepolia Testnet Demo Runbook

Goal: deploy `CredentialRegistry` to the Sepolia public testnet and demonstrate the
full workflow (issue → own → grant → verify → revoke) with transactions visible on a
block explorer. This earns the **additional points**. Your local tests already cover
the base points.

Budget ~45–60 minutes the first time. Do a dry run before the live demo.

---

## 0. Where each file goes in your repo

| File I gave you | Put it here |
|---|---|
| `hardhat.config.js` | repo root (replace the existing one) |
| `.env.example` | repo root |
| `deploy.js` | `scripts/deploy.js` |
| `credchain-frontend.html` | repo root (or a new `frontend/` folder) |

Then install the one new dependency:

```bash
npm install dotenv
```

---

## 1. 🔐 Secure your secrets FIRST (do not skip)

Your current `.gitignore` does **not** ignore `.env`. Before creating any `.env`,
add this line to `.gitignore`:

```
.env
```

If you ever commit a private key to GitHub, treat that key as compromised — abandon the
account. Only ever use a **throwaway MetaMask account** created for this class, never a
wallet holding real funds.

---

## 2. Get a Sepolia RPC URL (Alchemy, free)

1. Sign up at https://www.alchemy.com → create an app → Chain: Ethereum, Network: Sepolia.
2. Copy the HTTPS URL, looks like `https://eth-sepolia.g.alchemy.com/v2/XXXX`.
   (Infura works identically if you prefer.)

## 3. Create accounts and get test ETH

In MetaMask, enable Sepolia (Settings → Advanced → Show test networks) and create these
accounts:

- **Account A — admin + university** (this deploys the contract and issues)
- **Account B — student** (holder; grants access)
- **Account C — employer** (verifier; only does free reads, needs no ETH)

Fund **A** and **B** with Sepolia ETH from a faucet (0.05 ETH each is plenty):
- https://www.alchemy.com/faucets/ethereum-sepolia
- https://sepoliafaucet.com

> Simplest version: use just **A** (admin+university) and **B** (student). The employer
> read can be done from any account, even A, since it's a free view call. But using a
> distinct employer account makes the access-control story clearer in the demo.

## 4. Fill in `.env`

Copy `.env.example` to `.env` and fill:

```
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/XXXX
PRIVATE_KEY=<private key of Account A>          # MetaMask → Account details → Show private key
ETHERSCAN_API_KEY=<optional, from etherscan.io/myapikey>
```

## 5. Compile and deploy

```bash
npx hardhat compile
npx hardhat run scripts/deploy.js --network sepolia
```

You'll see:

```
CredentialRegistry deployed to: 0xABC...123
Etherscan: https://sepolia.etherscan.io/address/0xABC...123
```

📸 **Screenshot this.** Copy the contract address.

**(Optional but impressive)** verify the source on Etherscan so graders can read it:

```bash
npx hardhat verify --network sepolia 0xABC...123
```

## 6. Open the frontend

Because the page uses MetaMask, serve it over http rather than opening the file directly:

```bash
npx http-server . -p 8080
# then open http://localhost:8080/credchain-frontend.html
```

(Or use VS Code's "Live Server" extension → right-click the HTML → Open with Live Server.)

1. Paste the **contract address** into the top field.
2. Click **Connect MetaMask** (make sure it says the green "Sepolia" pill).
3. Get the credential id: run `npm run hash` in the repo and confirm it matches the
   pre-filled id in the page (it should, if you didn't change `credential-jane.json`).

---

## 7. The live demo — the exact 5 steps your professor asked for

Do these in order, switching the MetaMask account before each step. Click **Refresh
state** after each to show the change. Each transaction logs an Etherscan link — open a
couple during the demo to show the block explorer.

| # | Switch MetaMask to | Action in the page | What it proves |
|---|---|---|---|
| 1 | **Account A (admin)** | Fill issuer = Account A address, click **addIssuer()** | Registrar authorizes the university |
| 2 | **Account A (university)** | Fill holder = Account B, click **issueCredential()** | University issues the diploma; state shows holder = student, status = Active |
| 3 | **Account C (employer)** | Click **getMetadataURI()** | Reverts "Access denied" — privacy control working |
| 4 | **Account B (student)** | Fill verifier = Account C, click **grantAccess()** | Student, not the university, controls disclosure |
| 5 | **Account C (employer)** | Click **getMetadataURI()** again | Now returns the pointer — verifier can read it |
| 6 (opt.) | **Account A (university)** | Click **revokeCredential()** | Status flips to Revoked; isValid() → false |

For each transaction, the demo should show: the click in the frontend → MetaMask popup
signing it → the tx hash → the tx on `sepolia.etherscan.io` → the updated state in the
"Live on-chain state" panel. That is exactly the "user interaction → contract call →
blockchain transaction → state change" loop the rubric asks for.

📸 Capture: the deployed contract on Etherscan, 2–3 transaction pages, and the state
panel before/after grantAccess.

---

## 8. If something breaks during the demo (fallback)

- **"insufficient funds"** → the active account has no Sepolia ETH; use a funded one or hit the faucet again.
- **"Already issued"** → you already issued this id. Either revoke, or edit
  `credential-jane.json` slightly, re-run `npm run hash`, and paste the new id.
- **Wrong network pill** → switch MetaMask to Sepolia; the page auto-reconnects.
- **Frontend won't sign** → make sure you served it over http (step 6), not `file://`.
- **Total fallback:** your local `scripts/demo-localnode.js` still runs the whole flow
  offline (`npx hardhat node` + `npx hardhat run scripts/demo-localnode.js --network localhost`).
  That secures the base points regardless of testnet issues.

---

## Checklist

- [ ] `.env` is gitignored
- [ ] `npm install dotenv` done
- [ ] Accounts A & B funded with Sepolia ETH
- [ ] Contract deployed; address + Etherscan link screenshotted
- [ ] (opt.) Contract verified on Etherscan
- [ ] Frontend connects, green Sepolia pill
- [ ] Full 5-step scenario runs end-to-end
- [ ] Screenshots captured for the report/demo
