import { ethers } from 'hardhat'
import '@nomiclabs/hardhat-ethers'
import { deployAllContracts } from './deploymentUtils'
import { writeFile } from 'fs/promises'
async function main() {
  const [signer] = await ethers.getSigners()

  try {
    // Deploying all contracts
    const contracts = await deployAllContracts(signer)

    // Call setTemplates with the deployed contract addresses
    console.log('Waiting for the Template to be set on the Rollup Creator')
    await contracts.rollupCreator.setTemplates(
      contracts.bridgeCreator.address,
      contracts.osp.address,
      contracts.challengeManager.address,
      contracts.rollupAdmin.address,
      contracts.rollupUser.address,
      contracts.upgradeExecutor.address,
      contracts.validatorUtils.address,
      contracts.validatorWalletCreator.address,
      contracts.deployHelper.address
    )

    const contractAddress = {
      bridgeCreator: contracts.bridgeCreator.address,
      osp: contracts.osp.address,
      challengeManager: contracts.challengeManager.address,
      rollupAdmin: contracts.rollupAdmin.address,
      rollupUser: contracts.rollupUser.address,
      upgradeExecutor: contracts.upgradeExecutor.address,
      validatorUtils: contracts.validatorUtils.address,
      validatorWalletCreator: contracts.validatorWalletCreator.address,
      deployHelper: contracts.deployHelper.address,
      RollupCreator: contracts.rollupCreator.address,
      ethSequencerInbox: contracts.ethSequencerInbox.address,
    }
    console.log('Template is set on the Rollup Creator')
    await writeFile(
      'DeploymentBaseContract.json',
      JSON.stringify(contractAddress, null, 2)
    )
  } catch (error) {
    console.error(
      'Deployment failed:',
      error instanceof Error ? error.message : error
    )
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error)
    process.exit(1)
  })