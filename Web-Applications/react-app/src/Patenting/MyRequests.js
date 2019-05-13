import '../css/Pages.css'
import React, {Component} from 'react';
import {Grid, Row, PanelGroup} from 'react-bootstrap';
import {ContractNotFound} from '../utils/FunctionalComponents';
import Patenting from '../../build/contracts/Patenting';
import wrapWithMetamask from '../MetaMaskWrapper'
import {NOT_REQUESTED, contractError} from "../utils/ErrorHandler";

import Bundle from '../utils/ipfsBundle';

import RequestPanel from './RequestPanel';


/*Component for browsing submitted requests*/
class MyRequests_class extends Component {

  /*Constructor of the class*/
  constructor(props) {
    super(props);
    this.bundle = new Bundle();
    this.state = {
      web3: props.web3,
      contractInstance: null,
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
    const patenting = contract(Patenting);
    patenting.setProvider(this.state.web3.currentProvider);
    patenting.deployed().then(instance => {
      this.setState({contractInstance: instance});
      return instance.patentCount.call()
    }).then(count => {
      this.getMyRequests(count.toNumber());
    }).catch(error => this.setState({contractInstance: null}));
  }

  /*Fetches the requests from the smart contract*/
  getMyRequests(numPatents) {
    if (this.state.contractInstance !== null) {
      const instance = this.state.contractInstance;
      const currentAccount = this.state.web3.eth.accounts[0]
      for (let i = 0; i < numPatents; i++) {
        let new_entry = {};
        instance.patentNames.call(i).then(name => {
          new_entry['patentName'] = name;
          return instance.hasBeenRequested.call(new_entry['patentName'], currentAccount)
        }).then(alreadyRequested => {
          if (alreadyRequested) {
            return instance.getRequestStatus.call(new_entry['patentName'], currentAccount)
          } else {
            throw Error(NOT_REQUESTED)
          }
        }).then(status => {
          new_entry['status'] = status.toNumber();
          return instance.getPatentHash.call(new_entry['patentName']);
        }).then(hash => {
          new_entry['hash'] = hash;
          return instance.getPatentLocation.call(new_entry['patentName']);
        }).then(loc => {
          new_entry['ipfsLocation'] = loc;
          return instance.getRequestedLicence.call(new_entry['patentName'], currentAccount);
        }).then(requestedLicence => {
          new_entry['requestedLicence'] = requestedLicence.toNumber();
          return instance.getAcceptedLicence.call(new_entry['patentName'], currentAccount);
        }).then(acceptedLicence => {
          new_entry['acceptedLicence'] = acceptedLicence.toNumber();
          return instance.getPrices.call(new_entry['patentName']);
        }).then(prices => {
          new_entry['patentPrices'] = prices.map(price => price.toNumber());
          return Promise.all(prices.map(price => instance.getEthPrice(price)));
        }).then(ethPrices => {
          new_entry['patentEthPrices'] = ethPrices.map(ethPrice => ethPrice.toNumber());
          return instance.getMaxLicence(new_entry['patentName']);
        }).then(maxLicence => {
          new_entry['patentMaxLicence'] = maxLicence.toNumber();
          return instance.getOwnerEmail.call(new_entry['patentName']);
        }).then(mail => {
          new_entry['ownerEmail'] = mail;
          new_entry['id'] = (this.state.numRequests + 1);
          let requests = this.state.requests;
          requests.push(new_entry);
          this.setState({pendingRequests: requests, numRequests: this.state.numRequests + 1});
        }).catch(e => {
          if (e.message !== NOT_REQUESTED) { //Catch error if the patent is not authorized
            contractError(e)
          }
        })
      }
    }
  }


  /*To change between requests*/
  handleSelect(activeKey) {
    this.setState({activeKey: activeKey})
  }

  /*Returns a full table with patents*/
  renderTable() {
    if (this.state.numRequests !== 0) {
      let panels = this.state.requests.map(request => {
        return <RequestPanel web3={this.state.web3} instance={this.state.contractInstance} bundle={this.bundle}
                             request={request} key={request.id} gasPrice={this.state.gasPrice}/>
      });
      return (
        <PanelGroup
          accordion activeKey={this.state.activeKey} onSelect={this.handleSelect} id="accordion-controlled"
          className="requests-container">
          {panels}
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
    if (this.state.contractInstance === null) {
      return <ContractNotFound/>;
    } else {
      return (
        <Grid>
          <Row bsClass='contract-address'>
            Contract at {this.state.contractInstance.address} <br/>
            <br/> Current account {this.state.web3.eth.accounts[0]} (From Metamask)
          </Row>
          <Row>{this.renderTable()}</Row>
        </Grid>)
    }
  }
}

const MyRequests = wrapWithMetamask(MyRequests_class, MyRequests_class.header());
export default MyRequests