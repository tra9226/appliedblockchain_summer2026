# Evaluation: On-Chain vs Off-Chain Credential Storage (Trade-Off Study)

This folder is the self-contained trade-off comparison for CredChain's headline
operation, **credential issuance**, measured two ways:

- **Hash-anchored** (`CredentialRegistry`): stores only a keccak256 anchor + a
  pointer on-chain. The full record stays off-chain.
- **Full-record-on-chain** (`NaiveCredentialRegistry`): stores the entire
  credential record on-chain in cleartext. Deliberate anti-pattern baseline.

Both contracts issue the **same** Jane credential, read from
`offchain/credential-jane.json`, so the only variable is the storage strategy.

## How to reproduce

```
npm install
npx hardhat compile
npx hardhat node                                                # terminal A
npx hardhat run evaluation/measure-gas.js --network localhost   # terminal B
```

Raw captured output is in `gas-results.txt`.

## Results (real gasUsed, measured on a local Hardhat node)

| Operation | Anchored | Naive (full on-chain) | Difference |
|---|---|---|---|
| **Issuance** (per credential) | 162,271 | 212,409 | **+50,138 (+30.9%)** |
| Deployment (one-time) | 1,133,614 | 846,422 | -287,192 |

The anchored design costs **76.4%** of the naive issuance — a ~24% saving on
**every** credential issued.

### Monetary cost of one issuance

Cost = gas x gas price x ETH price. Gas price and ETH price are stated
assumptions (markets move); the gas counts are measured.

| Gas price | ETH = $2,500 | ETH = $3,500 |
|---|---|---|
| **10 gwei** — Anchored | $4.06 | $5.68 |
| **10 gwei** — Naive | $5.31 | $7.43 |
| **30 gwei** — Anchored | $12.17 | $17.04 |
| **30 gwei** — Naive | $15.93 | $22.30 |
| **100 gwei** — Anchored | $40.57 | $56.79 |
| **100 gwei** — Naive | $53.10 | $74.34 |

At every price point the naive design costs about 31% more per issuance.

## Discussion

**Break-even.** The naive contract is cheaper to *deploy* (287,192 gas less,
because it omits the access-control, revocation, and event machinery), but more
expensive on *every* issuance (+50,138 gas). Deployment happens once; issuance
happens once per credential, forever. Break-even is **287,192 / 50,138 ≈ 5.7
credentials** — after the sixth credential, the naive design is strictly more
expensive, permanently.

**Scaling (the deeper point).** Jane's record is short, so the measured overhead
is "only" +30.9%. Anchored issuance is **O(1) in record size** — it always stores
one 32-byte hash regardless of how long the credential is. Naive issuance is
**O(n)**: every additional field or transcript line is more SSTORE writes at
~20k gas per fresh 32-byte word. A full multi-course transcript would widen the
gap dramatically, while the anchored cost stays flat at 162,271.

**Privacy (not captured by gas).** The naive contract writes the student's name,
program, GPA, and dates to a public, permanent ledger in cleartext — an
irreversible disclosure. The anchored design writes only a hash, which reveals
nothing about the record's contents. This is a categorical privacy difference,
not a quantitative one, and it is the decisive reason to prefer anchoring even
where gas were equal.

**Latency / UX / complexity.** On a local node both issue in a single
transaction with no measurable latency difference; on a public network both pay
one block's confirmation. The anchored design adds modest off-chain complexity
(store the record, serve it to authorized verifiers) in exchange for the gas and
privacy wins — a trade we judge clearly worthwhile for credential data.

## Conclusion

Hash-anchoring wins on per-issuance gas (-24%), wins decisively on privacy
(hash vs. cleartext PII), and scales far better with record size (O(1) vs O(n)).
Its only cost is a one-time higher deployment and added off-chain plumbing,
recovered after ~6 credentials. For an academic credential registry this is the
correct design.
