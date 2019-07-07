const https = require('http');
const fs = require('fs');
const formidable = require('formidable');
const Patenter = require('./Patenting');
const HDWalletProvider = require('truffle-hdwallet-provider');
require('dotenv').config();

/**
 * Node server that manages Timestamping, Verification of timestamps, and Patenting
 */
// --------------------------------- Constants for storage and Blockchain interaction ----------------------------------

const ropsten_node = "https://ropsten.infura.io/v3/" + process.env.PROJECT_ID;
const local_rpc = "http://127.0.0.1:8545";

const provider = new HDWalletProvider(process.argv[2] === 'true' ? process.env.RPC_MNEMONIC: process.env.ROPSTEN_MNEMONIC,
                                      process.argv[2] === 'true' ? local_rpc : ropsten_node );

new Patenter(provider);

console.log('Listening at: ', process.argv[2] === 'true' ? local_rpc : ropsten_node);

// ---------------------------------------------------------------------------------------------------------------------
/**
 *
 * @param local: indicates if we want a local IP address or not
 * @returns {string}: The current IP address depending if we are in local or not
 *
 * Function that returns our IP address
 */
function getIPAddress(local = false) {
    let address = '0.0.0.0';
    let ifaces = require('os').networkInterfaces();
    for (let dev in ifaces) {
        ifaces[dev].filter((details) => details.family === 'IPv4' && details.internal === local ? address = details.address : undefined);
    }
    return address;
}
// --------------------------------------------------- HTTPS Server ----------------------------------------------------

// https server for timestamping and verification
var server = https.createServer( function (req, res) {

    res.setHeader('Access-Control-Allow-Origin', '*'); // TODO : Supprimer ?

    if (req.method === 'POST') {
        let response = [];
        let op = req.url;

        let form = new formidable.IncomingForm(); //New way of parsing, easier to read

        form.parse(req, async function (err, fields, _) {
            try {
                if (op === '/timestamp'){
                    console.log("=================== POST for timestamping ===================");
                    response = timestamper.addTimestamp(fields);
                }
                else if (op === '/verify'){
                    console.log("===================  POST for verification ===================");
                  let stamp_user = verifier.getTimestamp(fields);
                  let stamp = await stamp_user[0];
                  let email = stamp_user[1];
                  response = Verifier.getResponse(stamp.toNumber(), email)
                }
                else {
                    response = [404, "Operation not permitted"]
                }
            }
            catch (error) {
                response = [400, error.message]
            }
            res.writeHead(response[0], {'Content-Type': 'text/plain'});
            res.write(response[1]);
            res.end()
        })
    }
});

const port = 4000;
const host = getIPAddress(process.argv[2] === 'true');
// server.listen(port, host);
// console.log('Listening at http://' + host + ':' + port);