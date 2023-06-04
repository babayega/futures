import { HardhatRuntimeEnvironment } from "hardhat/types";

const main = async ({
  network,
  deployments,
  getNamedAccounts,
}: HardhatRuntimeEnvironment) => {
  console.log('here')
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  console.log(`Deploying RPS Contract on ${network.name}`);

  const usdcTokenAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
  const btcPriceOracle = '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c';

  const fut = await deploy("Futures", {
    contract: "Futures",
    from: deployer,
    args: [usdcTokenAddress, btcPriceOracle],
  });

  console.log(`Futures @ ${fut.address}`);
};
main.tags = ["Futures"];

export default main;
