import '../css/Pages.css'
import React, {Component} from 'react';
import {Grid, Row, PanelGroup} from 'react-bootstrap';
import {ContractNotFound} from '../utils/FunctionalComponents';
import Patents from '../../build/contracts/Patents';
import Requests from '../../build/contracts/Requests';
import wrapWithMetamask from '../MetaMaskWrapper'
import {contractError} from "../utils/ErrorHandler";
import Bundle from '../utils/ipfsBundle';
import RequestPanel from './RequestPanel';
import {RequestStatus, getStatusString, /*Constants*/} from '../utils/Constants'

/*Component for browsing submitted requests*/
class MyRequests_class extends Component {

  /*Constructor of the class*/
  constructor(props) {
    super(props);
    this.bundle = new Bundle();
    this.state = {
      web3: props.web3,
      patentsInstance: null,
      requestsInstance: null,
      numRequests: 0,
      activeKey: 1,
      requests: [],
      gasPrice : 0,
    };
    this.handleSelect = this.handleSelect.bind(this)
  }

  componentDidMount() {
    this.state.web3.eth.getGasPrice((err, res) => this.setState({gasPrice : res.toNumber()}));
    const contract = require('truffle-contract');

    const requests = contract(Requests);
    requests.setProvider(this.state.web3.currentProvider);
    requests.deployed().then(instance => {
      this.setState({ requestsInstance: instance });
    }).catch(contractError);

    const patents = contract(Patents);
    patents.setProvider(this.state.web3.currentProvider);
    patents.deployed().then(instance => {
    // patenting.at(Constants.CONTRACT_ADDRESS).then(instance => { // for ROPSTEN
      this.setState({ patentsInstance: instance });
      return instance.patentCount.call();
    }).then(numPatents => {
      this.state.patentsInstance.folderCount.call().then(numFolders => {
        this.getMyRequests(numPatents.toNumber(), numFolders.toNumber());
      });
    }).catch(contractError);

    this.state.web3.currentProvider.on('accountsChanged', () => {
      this.state.patentsInstance.patentCount.call().then(numPatents => {
        this.state.patentsInstance.folderCount.call().then(numFolders => {
          this.getMyRequests(numPatents.toNumber(), numFolders.toNumber());
        });
      }).catch(contractError);
    });
  }

  /*Fetches one given request from the smart contract*/
  loadRequest(patentID, userID) {
    const patents = this.state.patentsInstance;
    const requests = this.state.requestsInstance;
    const numRequests = this.state.numRequests;
    return new Promise(function(resolve, reject) {
      let request = { patentID };
      requests.getRequestStatus.call(patentID, userID).then(status => {
        request['status'] = status.toNumber();
        if (request.status !== RequestStatus.NOT_REQUESTED) {
          patents.getPatentName.call(request.patentID).then(name => {
            request['patentName'] = name;
            return patents.getNumVersions.call(patentID);
          }).then(numVersions => {
            request['patentNumVersions'] = numVersions.toNumber();
            request['patentLocations'] = [];
            for(let j = 0; j < request.patentNumVersions; j++) {
              patents.getPatentLocation.call(patentID, j).then(loc => {
                request['patentLocations'].push(loc);
              });
            }
            return requests.getRequestedLicence.call(patentID, userID);
          }).then(requestedLicence => {
            request['requestedLicence'] = requestedLicence.toNumber();
            return requests.getAcceptedLicence.call(patentID, userID);
          }).then(acceptedLicence => {
            request['acceptedLicence'] = acceptedLicence.toNumber();
            return patents.getRate.call(patentID, userID);
          }).then(rate => {
            request['rate'] = rate.toNumber();
            return patents.getPrices.call(patentID);
          }).then(prices => {
            request['patentPrices'] = prices.map(price => price.toNumber());
            return Promise.all(prices.map(price => patents.getEthPrice.call(price)));
          }).then(ethPrices => {
            request['patentEthPrices'] = ethPrices.map(ethPrice => ethPrice.toNumber());
            return patents.getMaxLicence(patentID);
          }).then(maxLicence => {
            request['patentMaxLicence'] = maxLicence.toNumber();
            return patents.getOwnerEmail.call(patentID);
          }).then(mail => {
            request['patentOwnerEmail'] = mail;
            request['id'] = (numRequests + 1);
            resolve(request);
          });
        }
      }).catch(reject);
    });
  }

  /*Fetches the requests*/
  getMyRequests(numPatents, numFolders) {
    this.setState({ requests: [], numRequests: 0 });
    const patents = this.state.patentsInstance;
    const requests = this.state.requestsInstance;
    if (patents !== null && requests !== null) {
      for (let i = 0; i < numPatents; i++) {
        patents.patentIDs.call(i).then(id => {
          return this.loadRequest(id, this.state.web3.eth.accounts[0]);
        }).then(request => {
          if (request.status !== RequestStatus.NOT_REQUESTED) {
            request['isFromFolder'] = false;
            let requests = this.state.requests;
            requests.push(request);
            this.setState({requests, numRequests: this.state.numRequests + 1});
          }
        }).catch(console.log);
      }
      for (let i = 0; i < numFolders; i++) {
        patents.folderIDs.call(i).then(id => {
          return this.loadRequest(id, this.state.web3.eth.accounts[0]);
        }).then(request => {
          if (request.status !== RequestStatus.NOT_REQUESTED) {
            request['isFromFolder'] = true;
            let requests = this.state.requests;
            requests.push(request);
            console.log(request);
            this.setState({requests, numRequests: this.state.numRequests + 1});
          }
        }).catch(console.log);
      }
    }
  }

  /*To change between requests*/
  handleSelect(activeKey) {
    this.setState({ activeKey })
  }

  /*Returns a full table with patents*/
  renderTable() {
    if (this.state.numRequests !== 0) {
      return (
        <PanelGroup
          accordion activeKey={this.state.activeKey} onSelect={this.handleSelect} id="accordion-controlled"
          className="requests-container">
          {Object.values(RequestStatus).filter(s => s > 0).map(s => {
            const statusRequests = this.state.requests.filter(r => r.status === s);
            return statusRequests.length > 0 && (
              <div key={s}>
                <h3>{getStatusString(s)} requests</h3>
                {statusRequests.sort((r1, r2) => r1.patentName < r2.patentName ? -1 : 1).map(request => (
                  <RequestPanel web3={this.state.web3} bundle={this.bundle} request={request} key={request.id}
                                requestsInstance={this.state.requestsInstance} patentsInstance={this.state.patentsInstance}
                                gasPrice={this.state.gasPrice}/>
                ))}
                <br/>
              </div>
          )})}
        </PanelGroup>)
    } else {
      return <div className='not-found'><h3>You do not have any requests on this network</h3></div>
    }
  }

  /*Header for the Component, For the Metamask wrapper*/
  static header() {
    return (
      <Grid>
        <br/>
        <Row bsClass='title'>My requests</Row>
        <hr/>
        <Row bsClass='paragraph'>
          <p>This page allows users to view the requests they have submitted and view documents they have access
            to. <br/>
            <br/>You only need to <b>unlock your Metamask extension</b>.
          </p>
        </Row>
      </Grid>

    );
  }

  /*Rendering function of the component*/
  render() {
    if (this.state.patentsInstance === null || this.state.requestsInstance === null) {
      return <ContractNotFound/>;
    } else {
      return (
        <Grid>
          <Row bsClass='contract-address'>
            Patents contract at {this.state.patentsInstance.address} <br/>
            Requests contract at {this.state.requestsInstance.address} <br/>
            <br/> Current account {this.state.web3.eth.accounts[0]} (From Metamask)
          </Row>
          <Row>{this.renderTable()}</Row>
        </Grid>)
    }
  }
}

const MyRequests = wrapWithMetamask(MyRequests_class, MyRequests_class.header());
export default MyRequests