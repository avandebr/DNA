import '../css/Pages.css'
import React, {Component} from 'react';
import {Table, Grid, Row} from 'react-bootstrap';
import {stampToDate, ContractNotFound} from '../utils/htmlElements';
import {toEther} from '../utils/stampUtil';
import Patenting from '../../build/contracts/Patenting';
import wrapWithMetamask from '../MetaMaskWrapper'

import Constants from '../Constants'
import {ALREADY_AUTHORIZED, contractError} from '../utils/ErrorHandler'

class BuyPatent_class extends Component {


  /*Constructor Method, initializes the State*/
  constructor(props) {
    super(props);
    this.state = {
      web3: props.web3,
      contractInstance: null,
      selectedPatent: "",
      numPatents: 0,
      patents: []
    };

    this.getPatents = this.getPatents.bind(this);
  }

  /*Method called before the component is mounted, initializes the contract and the page content*/
  componentWillMount() {
    const contract = require('truffle-contract');
    const patenting = contract(Patenting);
    patenting.setProvider(this.state.web3.currentProvider);
    patenting.deployed().then(instance => {
      this.setState({contractInstance: instance});
      return instance.patentCount.call()
    }).then(count => {
      this.setState({numPatents: count.toNumber()});
      this.getPatents(count.toNumber());
    }).catch(error => console.log('Error' + error)); //Todo : change this error handler
  }

  /*Function that gets all patent information form the contract and stores them in the state*/
  getPatents(numPatents) {
    if (this.state.contractInstance !== null) {
      let instance = this.state.contractInstance;
      for (let i = 0; i < numPatents; i++) {
        let new_entry = {};
        instance.patentNames.call(i).then(name => {
          new_entry['name'] = name;
          return instance.getPatentOwner.call(name);
        }).then(owner => {
          new_entry['owner'] = owner;
          return instance.getTimeStamp.call(new_entry['name'])
        }).then(timestamp => {
          new_entry['timestamp'] = timestamp.toNumber();
          return instance.getPrice.call(new_entry['name'])
        }).then(price => {
          new_entry['price'] = price;
          let patents = this.state.patents;
          patents.push(new_entry);
          this.setState({patents: patents});
        })
      }
    }
  }

  /*--------------------------------- EVENT HANDLERS ---------------------------------*/

  /*Function that initiates the contract call*/
  buyPatent(patent) {
    this.state.contractInstance.isAuthorized.call(patent.name, this.state.web3.eth.coinbase).then(authorized => {
      if (!authorized) {
        this.state.contractInstance.buyPatent(patent.name, {
          from: this.state.web3.eth.coinbase,
          value: patent.price,
          gas: Constants.GAS_LIMIT
        }).then(tx => alert("Successful " + tx.tx)).catch(e => contractError(e))
      } else {
        alert(ALREADY_AUTHORIZED)
      }
    })
  }

  /*--------------------------------- USER INTERFACE COMPONENTS ---------------------------------*/

  /*Header for the Component, For the Metamask wrapper*/
  static header() {
    return (
      <Grid>
        <Row bsClass='title'>Patent Store</Row>
        <Row bsClass='paragraph'>
          <p>This page allows users that have an Ethereum account and are using it on the Metamask
            extension for browsers, to buy access to Patents deposited by other users. <br/>

            <br/>You only need to <b>unlock your Metamask extension</b> and choose the document you want to access.
          </p>
        </Row>
      </Grid>
    );
  }

  /*Returns a table row for the given patent*/
  getRow(patent) {
    return (
      <tr key={patent.name} onClick={this.buyPatent.bind(this, patent)}>
        <td>{patent.name}</td>
        <td>{patent.owner}</td>
        <td>{stampToDate(patent.timestamp)}</td>
        <td>{toEther(patent.price, this.state.web3)}</td>
      </tr>
    )
  }

  /*Returns a full table with patents*/
  renderTable() {
    if (this.state.numPatents !== 0) {
      let table = this.state.patents.map(patent => this.getRow(patent));
      let header = (
        <tr>
          <th>Patent Name</th>
          <th>Owner's address</th>
          <th>Submission Date</th>
          <th>Patent Price (ETH)</th>
        </tr>
      );
      return (
        <Table striped hover responsive className='patent-table'>
          <thead>{header}</thead>
          <tbody>{table}</tbody>
        </Table>)
    } else {
      return <div className='not-found'><h3>There are no deposited patents on this Network</h3></div>
    }
  }

  /*Rendering function of the component*/
  render() {
    if (this.state.contractInstance === null) {
      return <ContractNotFound/>;
    } else {
      return (
        <Grid>
          <Row bsClass='contract-address'>
            Patenting contract at {this.state.contractInstance.address} <br/>
            <br/> Current account {this.state.web3.eth.accounts[0]} (From Metamask)
          </Row>
          <Row>{this.renderTable()}</Row>
        </Grid>);
    }
  }
}

const BuyPatent = wrapWithMetamask(BuyPatent_class, BuyPatent_class.header());
export default BuyPatent
