const mailer = require('./Mail-server');
const contract = require('truffle-contract');
const requestsAbi = require('./build/contracts/Requests.json');
const requests = contract(requestsAbi);

/**
 * Watch for events emitted by the Smart Contract and notify users by email of these events
 */
class Patenting {

    /**
     *
     * @param provider_
     */
    constructor(provider_){
        requests.setProvider(provider_);
        requests.at('0xc2862de5B2EA31849e2B18ea4Da39615d292d5fE').then(instance => {
        // requests.deployed().then(instance => {
            instance.NewRequest().watch(function(err, res) {
                console.log('new request');
                if (err)
                    console.log(err);
                else {
                    let request = res.args;
                    mailer.sendRequest(request._ownerMail, request._patentName, request._rentee);
                }
            });
            instance.RequestResponse().watch(function(err, res) {
              console.log('request response');
                if (err)
                    console.log(err);
                else {
                    let response = res.args;
                    mailer.sendRequestResponse(response._requesterEmail, response._patentName, response._accepted);
                }
            })
        })
    }
}

module.exports = Patenting;