import '../css/Pages.css'
import React, {Component} from 'react';
import {Table, Grid, Row, Button, ButtonGroup, Glyphicon} from 'react-bootstrap';
import {ContractNotFound} from '../utils/FunctionalComponents';
import {stampToDate} from '../utils/UtilityFunctions';
import Patenting from '../../build/contracts/Patenting';
import wrapWithMetamask from '../MetaMaskWrapper';

import FileManager from './FileManager'

import {contractError} from '../utils/ErrorHandler'
import {Constants} from "../utils/Constants";


/*Component to view User's deposited patents*/
class MyFiles_class extends Component {

  /*Constructor Method, initializes the State*/
  constructor(props) {
    super(props);
    this.state = {
      web3: props.web3,
      contractInstance: null,
      numPatents: 0,
      patents: [],
      selectedPatent: null,
      gasPrice : 0,
      currentAccountRegistered: false,
    };
    this.getMyPatents = this.getMyPatents.bind(this);
    this.nextPatent = this.nextPatent.bind(this);
    this.prevPatent = this.prevPatent.bind(this);
  }

  /*Method called before the component is mounted, initializes the contract and the page content*/
  componentDidMount() {
    this.state.web3.eth.getGasPrice((err, res) => this.setState({gasPrice : res.toNumber()}));
    const contract = require('truffle-contract');
    const patenting = contract(Patenting);
    patenting.setProvider(this.state.web3.currentProvider);
    // patenting.deployed().then(instance => {
    patenting.at(Constants.CONTRACT_ADDRESS).then(instance => {
      this.setState({contractInstance: instance});
      return instance.hasAccount.call(this.state.web3.eth.accounts[0]);
    }).then(registered => {
      this.setState({ currentAccountRegistered: registered });
      return this.state.contractInstance.getNumPatents.call(this.state.web3.eth.accounts[0]);
    }).then(count => {
      this.setState({ numPatents: count.toNumber() });
      this.getMyPatents(count.toNumber());
    }).catch(() => this.setState({contractInstance: null}));
    // to refresh displayed account
    this.state.web3.currentProvider.on('accountsChanged', accounts => {
      this.hideDetails();
      this.state.contractInstance.hasAccount.call(accounts[0]).then(registered => {
        this.setState({ currentAccountRegistered: registered });
        return this.state.contractInstance.getNumPatents.call(accounts[0]);
      }).then(count => {
        this.setState({ numPatents: count.toNumber() });
        this.getMyPatents(count.toNumber());
      }).catch(() => this.setState({ contractInstance: null }));
    });
  }

  /*Function that gets all owned patent information form the contract and stores them in the state*/
  getMyPatents(numPatents) {
    this.setState({patents: []});
    if (this.state.contractInstance !== null) {
      let instance = this.state.contractInstance;
      for (let i = 0; i < numPatents; i++) {
        let new_entry = {};
        instance.getOwnedPatentIDs.call(this.state.web3.eth.accounts[0], i).then(id => {
          new_entry['id'] = id;
          return instance.getTimeStamp.call(new_entry['id'])
        }).then(timestamp => {
          new_entry['timestamp'] = timestamp.toNumber();
          return instance.isDeleted.call(new_entry['id']);
        }).then(deleted => {
          new_entry['deleted'] = deleted;
          return instance.getNumRequests.call(new_entry['id']);
        }).then(num => {
          new_entry['numRequests'] = num.toNumber();
          return instance.getPatentName.call(new_entry['id']);
        }).then(name => {
          new_entry['name'] = name;
          return instance.getPatentLocation.call(new_entry['id']);
        }).then(loc => {
          new_entry['ipfsLocation'] = loc;
          return instance.getMaxLicence.call(new_entry['id']);
        }).then(licence => {
          new_entry['maxLicence'] = licence.toNumber();
          return instance.getPrices.call(new_entry['id']);
        }).then(prices => {
          new_entry['licencePrices'] = prices.map(price => price.toNumber());
          new_entry['index'] = i;
          let patents = this.state.patents;
          patents.push(new_entry);
          this.setState({patents: patents});
        }).catch(contractError);
      }
    }
  }

  /*--------------------------------- EVENT HANDLERS ---------------------------------*/

  /*Displays the details of a given patent*/
  openDetails(patent) {
    this.setState({selectedPatent: patent});
  }

  hideDetails() {
    this.setState({selectedPatent: null});
  }

  /*Buttons to scroll through documents*/
  prevPatent() {
    if (this.state.selectedPatent && this.state.selectedPatent.index > 0) {
      this.setState({selectedPatent: this.state.patents[this.state.selectedPatent.index - 1]})
    }
  }

  nextPatent() {
    if (this.state.selectedPatent && this.state.selectedPatent.index < this.state.numPatents - 1) {
      this.setState({selectedPatent: this.state.patents[this.state.selectedPatent.index + 1]})
    }
  }

  /*--------------------------------- USER INTERFACE COMPONENTS ---------------------------------*/

  /*Button toolbar to scroll through documents*/
  buttonToolbar() {
    return (
      <ButtonGroup justified>
        <ButtonGroup>
          <Button onClick={this.prevPatent} disabled={this.state.selectedPatent.index === 0}>
            <Glyphicon glyph="menu-left"/> Prev File
          </Button>
        </ButtonGroup>
        <ButtonGroup>
          <Button onClick={() => this.hideDetails()}>
            <Glyphicon glyph="triangle-top"/> Hide Details <Glyphicon glyph="triangle-top"/>
          </Button>
        </ButtonGroup>
        <ButtonGroup>
          <Button onClick={this.nextPatent} disabled={this.state.selectedPatent.index === this.state.numPatents - 1}>
            Next File <Glyphicon glyph="menu-right"/>
          </Button>
        </ButtonGroup>
      </ButtonGroup>);
  }


  /*Renders the details of a selected patent*/
  renderDetails() {
    return (
        <div className="requests-container">
          {this.buttonToolbar()}
          <FileManager web3={this.state.web3} contractInstance={this.state.contractInstance}
                       patent={this.state.selectedPatent} gasPrice={this.state.gasPrice} />
        </div>
    )
  }

  /*Header for the Component, For the Metamask wrapper*/
  static header() {
    return (
      <Grid>
        <br/>
        <Row bsClass='title'>My Files</Row>
        <hr/>
        <Row bsClass='paragraph'>
          <p>This page allows users to view the Documents they have deposited, and manage the requests. <br/>
            To see the details, just click on the row.<br/>
            <br/>You only need to <b>unlock your Metamask extension</b>.
          </p>
        </Row>
      </Grid>

    );
  }

  /*Returns a full table with patents*/
  // TODO: put deleted patents in a separate table ?
  renderTable() {
    if (this.state.numPatents > 0) {
      const header = (
        <tr>
          <th>Patent Name</th>
          <th>Submission Date</th>
          <th>Number of requests</th>
        </tr>
      );
      const table = this.state.patents.map(patent => (
        <tr key={patent.id} onClick={this.openDetails.bind(this, patent)}>
          <td>{patent.name}</td>
          <td>{stampToDate(patent.timestamp)}</td>
          <td>{patent.numRequests}</td>
        </tr>
      ));
      return (
        <Table striped hover responsive className='patent-table'>
          <thead>{header}</thead>
          <tbody>{table}</tbody>
        </Table>)
    } else {
      return <div className='not-found'><h3>You do not have any deposited files on this network</h3></div>
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
            Contract at {this.state.contractInstance.address}
            <br/><br/>
            Current account {this.state.web3.eth.accounts[0]} (From Metamask)
            <br/>
            {!this.state.currentAccountRegistered && "Your current Metamask account is not registered. Please "}
            <a href="/registerArtist">{!this.state.currentAccountRegistered && "register it here"}</a>
            {!this.state.currentAccountRegistered && " to deposit patents"}
          </Row>
          <Row>
            {this.state.selectedPatent ? this.renderDetails() : this.renderTable()}
          </Row>
        </Grid>
      );
    }
  }
}

const MyFiles = wrapWithMetamask(MyFiles_class, MyFiles_class.header());
export default MyFiles
