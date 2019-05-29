import './css/Pages.css'

import React, {Component} from 'react';
import {Grid, Row} from 'react-bootstrap';

import getWeb3 from './utils/getWeb3'
import {METAMASK_NOTFOUND, UNLOCK_METAMASK} from './utils/ErrorHandler'

/*Constants for rendering and network selection*/

const Networks = {
  MAINNET: 1,
  ROPSTEN: 3,
  KOVAN: 42,
  LOCALRPC: 5777
};

const NetworkToString = {
  [Networks.MAINNET]: "Ethereum Main Net",
  [Networks.ROPSTEN]: "Ropsten Test Net",
  [Networks.KOVAN]: "Kovan Test Net",
  [Networks.LOCALRPC]: "Local RPC"
};


/*---------------------------------------------------------------------------------- DONE ----------------------------------------------------------------------------------*/

/* This function wraps The given component with a Metamask Component. This make code reusable
* The returned component communicates with the Web3 object injected by Metamask and handles the choice of Network
* This page requires a Web3 object injected into the web page
*
* The component passed to the constructor as a props is the Child component (TimestampMetamask, VerifyMetamask, DepositFile or Store)
* */
function wrapWithMetamask(Wrapped, header) {
  return class extends Component {
    constructor(props) {
      super(props);
      this.state = {
        web3: null,
        contractInstance: null,
        selectedNetwork: null,
        loadChild: false,
      };
      this.resetState = this.resetState.bind(this);
    }

    componentDidMount() {
      this.getWeb3Object();
    }

    /* Resets the state of the Component*/
    resetState() {
      this.setState({
        web3: null,
        contractInstance: null,
        selectedNetwork: null,
        loadChild: false
      });
    }

    /* Tries to get the injected web3 object of the selected network
    * */
    getWeb3Object() {
      getWeb3.then(result => {
        this.setState({web3: result.web3});
        result.web3.eth.getAccounts((err, accounts) => {
          if (err || accounts.length === 0) {
            window.dialog.showAlert(UNLOCK_METAMASK);
            this.resetState();
          } else {
            this.setNetwork();
          }
        });
        this.state.web3.currentProvider.on('networkChanged', netId => {
          this.setState({ selectedNetwork: netId });
        });
      }).catch(e => {
        window.dialog.showAlert(METAMASK_NOTFOUND);
      });
    }

    getNetwork() {
      return NetworkToString[this.state.selectedNetwork];
    }

    /*Verifies the if the chosen network corresponds to the one in metamask
    * */
    setNetwork() {
      this.state.web3.version.getNetwork((err, id) => {
        id = parseInt(id, 10);
        this.setState({selectedNetwork: id, loadChild: true});
      })
    }

    /*
    * Rendering for the page
    * */
    render() {
      return (
        <Grid>
          <Row>{header}</Row>
          <Row bsClass="contract-address">Connected to {this.getNetwork()}</Row>
          <Row>{this.state.loadChild ? <Wrapped web3={this.state.web3}/> : ""}</Row>
        </Grid>
      );
    }
  }
}


export default wrapWithMetamask