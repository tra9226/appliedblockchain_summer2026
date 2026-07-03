// scripts/deploy.js  — deploy CredentialRegistry to whatever --network you pass.
// Usage: npx hardhat run scripts/deploy.js --network sepolia

const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log("Deploying CredentialRegistry");
  console.log("  deployer (admin):", deployer.address);
  console.log("  balance:", ethers.formatEther(balance), "ETH");

  if (balance === 0n) {
    throw new Error(
      "Deployer has 0 ETH. Fund this address with Sepolia test ETH from a faucet first."
    );
  }

  const Registry = await ethers.getContractFactory("CredentialRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  console.log("\nCredentialRegistry deployed to:", address);
  console.log("On-chain admin():", await registry.admin());
  console.log("Etherscan:", `https://sepolia.etherscan.io/address/${address}`);
  console.log("\n>>> Paste this address into the frontend (CONTRACT_ADDRESS). <<<");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
