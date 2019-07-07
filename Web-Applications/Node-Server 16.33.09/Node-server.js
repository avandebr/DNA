const Patenter = require('./Patenting-server');
const HDWalletProvider = require('truffle-hdwallet-provider');
require('dotenv').config();

/**
 * Node server that manages Patenting events triggered by the smart contract
 */
const ropsten_node = "https://ropsten.infura.io/v3/" + process.env.PROJECT_ID;
const local_rpc = "http://127.0.0.1:8545";

const provider = new HDWalletProvider(process.argv[2] === 'true' ? process.env.RPC_MNEMONIC: process.env.ROPSTEN_MNEMONIC,
                                      process.argv[2] === 'true' ? local_rpc : ropsten_node );
new Patenter(provider);

provider.engine.stop();