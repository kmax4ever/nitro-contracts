import { ethers } from 'hardhat'
import '@nomiclabs/hardhat-ethers'
import { run } from 'hardhat'
import { abi as rollupCreatorAbi } from '../build/contracts/src/rollup/RollupCreator.sol/RollupCreator.json'
import { config, maxDataSize } from './config'
import { BigNumber } from 'ethers'
import { IERC20__factory } from '../build/types'
import { sleep } from './testSetup'
import * as DeploymentBaseContract from '../DeploymentBaseContract.json'
import { writeFile } from 'fs/promises'
import { PrepareNodeConfigParams, prepareNodeConfig } from '@arbitrum/orbit-sdk'
// 1 gwei
const MAX_FER_PER_GAS = BigNumber.from('1000000000')

interface RollupCreatedEvent {
  event: string
  address: string
  args?: {
    rollupAddress: string
    inboxAddress: string
    outbox: string
    rollupEventInbox: string
    challengeManager: string
    adminProxy: string
    sequencerInbox: string
    bridge: string
    validatorUtils: string
    validatorWalletCreator: string
  }
}

export async function createRollup(feeToken?: string) {
  const rollupCreatorAddress = DeploymentBaseContract.RollupCreator

  if (!rollupCreatorAddress) {
    console.error(
      'Please provide ROLLUP_CREATOR_ADDRESS as an environment variable.'
    )
    process.exit(1)
  }

  if (!rollupCreatorAbi) {
    throw new Error(
      'You need to first run <deployment.ts> script to deploy and compile the contracts first'
    )
  }

  const [signer] = await ethers.getSigners()

  const rollupCreator = new ethers.Contract(
    rollupCreatorAddress,
    rollupCreatorAbi,
    signer
  )

  if (!feeToken) {
    feeToken = ethers.constants.AddressZero
  }

  try {
    let vals: boolean[] = []
    for (let i = 0; i < config.validators.length; i++) {
      vals.push(true)
    }

    //// funds for deploying L2 factories

    // 0.13 ETH is enough to deploy L2 factories via retryables. Excess is refunded
    let feeCost = ethers.utils.parseEther('0.13')
    if (feeToken != ethers.constants.AddressZero) {
      // in case fees are paid via fee token, then approve rollup cretor to spend required amount
      await (
        await IERC20__factory.connect(feeToken, signer).approve(
          rollupCreator.address,
          feeCost
        )
      ).wait()
      feeCost = BigNumber.from(0)
    }

    // Call the createRollup function
    console.log('Calling createRollup to generate a new rollup ...')
    const deployParams = {
      config: config.rollupConfig,
      batchPosters: config.batchPosters,
      validators: config.validators,
      maxDataSize: maxDataSize,
      nativeToken: feeToken,
      deployFactoriesToL2: true,
      maxFeePerGasForRetryables: MAX_FER_PER_GAS,
      batchPosterManager: config.batchPosters[0],
    }

    console.log(deployParams)

    const createRollupTx = await rollupCreator.createRollup(deployParams, {
      value: feeCost,
    })
    const createRollupReceipt = await createRollupTx.wait()

    const rollupCreatedEvent = createRollupReceipt.events?.find(
      (event: RollupCreatedEvent) =>
        event.event === 'RollupCreated' &&
        event.address.toLowerCase() === rollupCreatorAddress.toLowerCase()
    )

    // Checking for RollupCreated event for new rollup address
    if (rollupCreatedEvent) {
      const rollupAddress = rollupCreatedEvent.args?.rollupAddress
      const inboxAddress = rollupCreatedEvent.args?.inboxAddress
      const outbox = rollupCreatedEvent.args?.outbox
      const rollupEventInbox = rollupCreatedEvent.args?.rollupEventInbox
      const challengeManager = rollupCreatedEvent.args?.challengeManager
      const adminProxy = rollupCreatedEvent.args?.adminProxy
      const sequencerInbox = rollupCreatedEvent.args?.sequencerInbox
      const bridge = rollupCreatedEvent.args?.bridge
      const validatorUtils = rollupCreatedEvent.args?.validatorUtils
      const validatorWalletCreator =
        rollupCreatedEvent.args?.validatorWalletCreator

      console.log("Congratulations! 🎉🎉🎉 All DONE! Here's your addresses:")
      console.log('RollupProxy Contract created at address:', rollupAddress)
      console.log('Wait a minute before starting the contract verification')
      await sleep(1 * 60 * 1000)
      console.log(
        `Attempting to verify Rollup contract at address ${rollupAddress}...`
      )
      try {
        await run('verify:verify', {
          contract: 'src/rollup/RollupProxy.sol:RollupProxy',
          address: rollupAddress,
          constructorArguments: [],
        })
      } catch (error: any) {
        if (error.message.includes('Already Verified')) {
          console.log(`Contract RollupProxy is already verified.`)
        } else {
          console.error(
            `Verification for RollupProxy failed with the following error: ${error.message}`
          )
        }
      }
      console.log('Inbox (proxy) Contract created at address:', inboxAddress)
      console.log('Outbox (proxy) Contract created at address:', outbox)
      console.log(
        'rollupEventInbox (proxy) Contract created at address:',
        rollupEventInbox
      )
      console.log(
        'challengeManager (proxy) Contract created at address:',
        challengeManager
      )
      console.log('AdminProxy Contract created at address:', adminProxy)
      console.log('SequencerInbox (proxy) created at address:', sequencerInbox)
      console.log('Bridge (proxy) Contract created at address:', bridge)
      console.log('ValidatorUtils Contract created at address:', validatorUtils)
      console.log(
        'ValidatorWalletCreator Contract created at address:',
        validatorWalletCreator
      )

      const deployedAtBlockNumber = createRollupReceipt.blockNumber
      const txHashDeployOrbit = createRollupTx.hash

      console.log('All deployed at block number:', deployedAtBlockNumber)
      console.log('txHash', txHashDeployOrbit)
      const orbitSetupConfig = {
        networkFeeReceiver: config.deployer,
        infrastructureFeeCollector: config.deployer,
        staker: config.validators[0],
        batchPoster: config.batchPosters[0],
        chainOwner: config.deployer,
        chainId: config.chainId,
        chainName: 'GOATL2',
        minL2BaseFee: 100000000,
        parentChainId: Number(process.env.CHAIN_ID),
        'parent-chain-node-url': process.env.RPC_END_POINT,
        utils: validatorUtils,
        rollup: rollupAddress,
        inbox: inboxAddress,
        nativeToken: '0x0000000000000000000000000000000000000000',
        outbox: outbox,
        rollupEventInbox,
        challengeManager,
        adminProxy,
        sequencerInbox,
        bridge,
        upgradeExecutor: DeploymentBaseContract.upgradeExecutor,
        validatorUtils,
        validatorWalletCreator,
        deployedAtBlockNumber,
        txHashDeployOrbit,
      }
      await writeFile(
        'orbitSetupScriptConfig.json',
        JSON.stringify(orbitSetupConfig, null, 2)
      )

      console.log('--------------PREPARE NODE CONFIG---------------')

      const coreContracts = {
        rollup: rollupAddress,
        inbox: inboxAddress,
        nativeToken: '0x0000000000000000000000000000000000000000',
        outbox,
        rollupEventInbox,
        challengeManager,
        adminProxy,
        sequencerInbox,
        bridge,
        upgradeExecutor: DeploymentBaseContract.upgradeExecutor,
        validatorUtils,
        validatorWalletCreator,
        deployedAtBlockNumber,
      }
      const nodeConfigParameters: PrepareNodeConfigParams = {
        chainName: orbitSetupConfig.chainName,
        chainConfig: {
          homesteadBlock: 0,
          daoForkBlock: null,
          daoForkSupport: true,
          eip150Block: 0,
          eip150Hash:
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          eip155Block: 0,
          eip158Block: 0,
          byzantiumBlock: 0,
          constantinopleBlock: 0,
          petersburgBlock: 0,
          istanbulBlock: 0,
          muirGlacierBlock: 0,
          berlinBlock: 0,
          londonBlock: 0,
          clique: { period: 0, epoch: 0 },
          arbitrum: {
            EnableArbOS: true,
            AllowDebugPrecompiles: false,
            DataAvailabilityCommittee: false,
            InitialArbOSVersion: 11,
            GenesisBlockNum: 0,
            MaxCodeSize: 24576,
            MaxInitCodeSize: 49152,
            InitialChainOwner: config.deployer as any,
          },
          chainId: config.chainId,
        },
        coreContracts: coreContracts as any,
        batchPosterPrivateKey: process.env
          .BATCH_POSTER_PRIVATE_KEY as `0x${string}`,
        validatorPrivateKey: process.env.VALIDATOR_PRIVATE_KEY as `0x${string}`,
        parentChainId: Number(process.env.CHAIN_ID),
        parentChainRpcUrl: process.env.RPC_ENDPOINT as string,
      }

      nodeConfigParameters.parentChainBeaconRpcUrl = process.env.RPC_ENDPOINT

      const nodeConfig = prepareNodeConfig(nodeConfigParameters)
      await writeFile('nodeConfig.json', JSON.stringify(nodeConfig, null, 2))
    } else {
      console.error('RollupCreated event not found')
    }
  } catch (error) {
    console.error(
      'Deployment failed:',
      error instanceof Error ? error.message : error
    )
  }
}
