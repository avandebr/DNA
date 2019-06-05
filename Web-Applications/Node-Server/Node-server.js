const Patenter = require('./Patenting');
const HDWalletProvider = require('truffle-hdwallet-provider');
require('dotenv').config();

/**
 * Node server that manages Patenting events triggered by the smart contract
 */
const ropsten_node = "https://ropsten.infura.io/";
const local_rpc = "http://127.0.0.1:7545";

const provider = new HDWalletProvider(process.argv[2] === 'true' ? process.env.RPC_MNEMONIC: process.env.ROPSTEN_MNEMONIC,
                                      process.argv[2] === 'true' ? local_rpc : ropsten_node );

new Patenter(provider);

provider.engine.stop();