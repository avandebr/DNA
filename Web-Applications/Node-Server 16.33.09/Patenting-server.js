const mailer = require('./mailer');
const contract = require('truffle-contract');
const Patenting_abi = require('../react-app/build/contracts/Patenting.json');
const patenting = contract(Patenting_abi);
const contractBlockNo = 5738145;

/**
 * Watch for events emitted by the Smart Contract and notify users by email of these events
 */
class Patenting {

  constructor(provider_){
    patenting.setProvider(provider_);
    patenting.at('0xA6680B66DF9926FAAaAf5829becB7d4290954CD6').then(instance => {
      instance.NewRequest({}, { fromBlock: contractBlockNo, toBlock: 'latest' }).watch(function(err, res) {
        if (err) {
          console.log(err);
        } else {
          let request = res.args;
          mailer.sendRequest(request._ownerMail, request._patentName, request._rentee);
        }
      });
      instance.RequestResponse({}, { fromBlock: contractBlockNo, toBlock: 'latest' }).watch(function(err, res) {
        if (err) {
          console.log(err);
        } else {
          let response = res.args;
          mailer.sendRequestResponse(response._requesterEmail, response._patentName, response._accepted);
        }
      });
    });
    console.log('Listening to Smart Contract events...');
  }
}

module.exports = Patenting;