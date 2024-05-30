import { ethers } from 'ethers'
require('dotenv').config()
// 90% of Geth's 128KB tx size limit, leaving ~13KB for proving
// This need to be adjusted for Orbit chains
export const maxDataSize = 117964
import { generateChainId } from '@arbitrum/orbit-sdk/utils'

if (!process.env.DEVNET_PRIVKEY) {
  throw new Error(
    `Please provide the "DEPLOYER_PRIVATE_KEY" environment variable`
  )
}

if (!process.env.BATCH_POSTER_PRIVATE_KEY) {
  throw new Error(
    `Please provide the "BATCH_POSTER_PRIVATE_KEY" environment variable`
  )
}
if (!process.env.VALIDATOR_PRIVATE_KEY) {
  throw new Error(
    `Please provide the "BATCH_POSTER_PRIVATE_KEY" environment variable`
  )
}

const deployer = new ethers.Wallet(process.env.DEVNET_PRIVKEY as string)
const batchPoster = new ethers.Wallet(
  process.env.BATCH_POSTER_PRIVATE_KEY as string
).address

const validator = new ethers.Wallet(process.env.VALIDATOR_PRIVATE_KEY as string)
  .address

const chainId = generateChainId()

export const config = {
  rollupConfig: {
    confirmPeriodBlocks: ethers.BigNumber.from('45818'),
    extraChallengeTimeBlocks: ethers.BigNumber.from('200'),
    stakeToken: ethers.constants.AddressZero,
    baseStake: ethers.utils.parseEther('1'),
    wasmModuleRoot:
      '0xda4e3ad5e7feacb817c21c8d0220da7650fe9051ece68a3f0b1c5d38bbb27b21',
    owner: deployer.address,
    loserStakeEscrow: ethers.constants.AddressZero,
    chainId: ethers.BigNumber.from(chainId),
    chainConfig: `{"chainId":${chainId},"homesteadBlock":0,"daoForkBlock":null,"daoForkSupport":true,"eip150Block":0,"eip150Hash":"0x0000000000000000000000000000000000000000000000000000000000000000","eip155Block":0,"eip158Block":0,"byzantiumBlock":0,"constantinopleBlock":0,"petersburgBlock":0,"istanbulBlock":0,"muirGlacierBlock":0,"berlinBlock":0,"londonBlock":0,"clique":{"period":0,"epoch":0},"arbitrum":{"EnableArbOS":true,"AllowDebugPrecompiles":false,"DataAvailabilityCommittee":false,"InitialArbOSVersion":11,"InitialChainOwner":"${deployer.address}","GenesisBlockNum":0}}`,
    genesisBlockNum: ethers.BigNumber.from('0'),
    sequencerInboxMaxTimeVariation: {
      delayBlocks: ethers.BigNumber.from('5760'),
      futureBlocks: ethers.BigNumber.from('12'),
      delaySeconds: ethers.BigNumber.from('86400'),
      futureSeconds: ethers.BigNumber.from('3600'),
    },
  },
  validators: [validator],
  batchPosters: [batchPoster],
  deployer: deployer.address,
  chainId,
}
