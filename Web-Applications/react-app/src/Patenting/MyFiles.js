import '../css/Pages.css'
import React, {Component} from 'react';
import {Table, Grid, Row, Button, ButtonGroup, Glyphicon} from 'react-bootstrap';
import {ContractNotFound} from '../utils/FunctionalComponents';
import {contractError} from '../utils/ErrorHandler'
import {stampToDate} from '../utils/UtilityFunctions';
import Patents from '../../build/contracts/Patents';
import Requests from '../../build/contracts/Requests';
import Users from '../../build/contracts/Users';
import FileManager from './FileManager'
import {Constants} from "../utils/Constants";
import wrapWithMetamask from '../MetaMaskWrapper';

/*Component to view User's deposited patents*/
class MyFiles_class extends Component {

  /*Constructor Method, initializes the State*/
  constructor(props) {
    super(props);
    this.state = {
      web3: props.web3,
      patentsInstance: null,
      requestsInstance: null,
      usersInstance: null,
      numPatents: 0,
      numFolders: 0,
      patents: [],
      folders: [],
      selectedPatent: null,
      gasPrice : 0,
      currentAccountRegistered: false,
    };
    this.nextPatent = this.nextPatent.bind(this);
    this.prevPatent = this.prevPatent.bind(this);
  }

  /*Method called before the component is mounted, initializes the contract and the page content*/
  componentDidMount() {
    this.state.web3.eth.getGasPrice((err, res) => this.setState({gasPrice : res.toNumber()}));
    const contract = require('truffle-contract');

    const requests = contract(Requests);
    requests.setProvider(this.state.web3.currentProvider);
    requests.at(Constants.CONTRACT_ADDRESS.requests).then(instance => {
    // requests.deployed().then(instance => {
      this.setState({ requestsInstance: instance });
    }).catch(console.log);

    const patents = contract(Patents);
    patents.setProvider(this.state.web3.currentProvider);
    patents.at(Constants.CONTRACT_ADDRESS.patents).then(instance => {
    // patents.deployed().then(instance => {
      this.setState({ patentsInstance: instance });
      return instance.hasAccount.call(this.state.web3.eth.accounts[0]);
    }).then(registered => {
      this.setState({ currentAccountRegistered: registered });
    }).catch(console.log);

    const users = contract(Users);
    users.setProvider(this.state.web3.currentProvider);
    users.at(Constants.CONTRACT_ADDRESS.users).then(instance => {
    // users.deployed().then(instance => {
      this.setState({ usersInstance: instance });
      return instance.getNumPatents.call(this.state.web3.eth.accounts[0]);
    }).then(count => {
      this.setState({ numPatents: count.toNumber() });
      this.getMyPatents(count.toNumber());
      return this.state.usersInstance.getNumFolders.call(this.state.web3.eth.accounts[0]);
    }).then(count => {
      this.setState({ numFolders: count.toNumber() });
      this.getMyFolders(count.toNumber());
    }).catch(console.log);

    // to refresh displayed account
    this.state.web3.currentProvider.on('accountsChanged', () => {
      this.hideDetails();
    });
  }

  /*Fetches one given patent from the smart contract*/
  loadPatent(id) {
    const patents = this.state.patentsInstance;
    const requests = this.state.requestsInstance;
    const users = this.state.usersInstance;
    if (patents !== null && requests !== null && users !== null) {
      return new Promise((resolve, reject) => {
        let patent = { id };
        patents.getNumVersions.call(patent.id).then(numVersions => {
          patent['numVersions'] = numVersions.toNumber();
          patent['ipfsLocations'] = [];
          patent['timestamps'] = [];
          for (let j = 0; j < patent.numVersions; j++) {
            patents.getPatentLocation.call(patent.id, j).then(loc => {
              patent['ipfsLocations'].push(loc);
            });
            patents.getTimestamp.call(patent.id, j).then(timestamp => {
              patent['timestamps'].push(timestamp.toNumber());
            });
          }
          return patents.getMaxLicence.call(patent.id);
        }).then(licence => {
          patent['maxLicence'] = licence.toNumber();
          return patents.isDeleted.call(patent.id);
        }).then(deleted => {
          patent['deleted'] = deleted;
          return patents.getFolderHash.call(patent.id);
        }).then(folderID => {
          patent['folderID'] = folderID;
          return patents.getNumRequests.call(patent.id);
        }).then(numRequests => {
          patent['pendingRequesters'] = [];
          patent['rates'] = [];
          for (let j = 0; j < numRequests.toNumber(); j++) {
            patents.getBuyers.call(patent.id, j).then(userID => {
              requests.isPending.call(patent.id, userID).then(isPending => {
                if (isPending) {
                  patent.pendingRequesters.push(userID);
                }
              });
              patents.getRate.call(patent.id, userID).then(rate => {
                if (rate > 0) {
                  patent.rates.push(rate.toNumber())
                }
              });
            });
          }
          return patents.getPatentName.call(patent.id);
        }).then(name => {
          patent['name'] = name;
          const split = name.split('.');
          patent['fileExt'] = split[split.length - 1];
          return patents.getPrices.call(patent.id);
        }).then(prices => {
          patent['licencePrices'] = prices.map(price => price.toNumber());
          resolve(patent);
        }).catch(reject);
      });
    }
  }

  /*Function that gets all owned patent information form the contract and stores them in the state*/
  getMyPatents(numPatents) {
    this.setState({ patents: [] });
    const patents = this.state.patentsInstance;
    const requests = this.state.requestsInstance;
    const users = this.state.usersInstance;
    if (patents !== null && requests !== null && users !== null) {
      for (let i = 0; i < numPatents; i++) {
        users.getOwnedPatentIDs.call(this.state.web3.eth.accounts[0], i).then(id => {
          return this.loadPatent(id);
        }).then(patent => {
          patent['isFolder'] = false;
          patent['index'] = i;
          let patents = this.state.patents;
          patents.push(patent);
          this.setState({ patents });
        }).catch(contractError);
      }
    }
  }

  /*Function that gets all owned folder information form the contract and stores them in the state*/
  getMyFolders(numFolders) {
    this.setState({ folders: [] });
    const patents = this.state.patentsInstance;
    const requests = this.state.requestsInstance;
    const users = this.state.usersInstance;
    if (patents !== null && requests !== null && users !== null) {
      for (let i = 0; i < numFolders; i++) {
        users.getOwnedFolderIDs.call(this.state.web3.eth.accounts[0], i).then(id => {
          return this.loadPatent(id);
        }).then(folder => {
          folder['isFolder'] = true;
          folder['index'] = i;
          let folders = this.state.folders;
          folders.push(folder);
          this.setState({ folders });
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
    this.state.usersInstance.isRegistered.call(this.state.web3.eth.accounts[0]).then(registered => {
      this.setState({ currentAccountRegistered: registered });
      return this.state.usersInstance.getNumPatents.call(this.state.web3.eth.accounts[0]);
    }).then(count => {
      this.setState({ numPatents: count.toNumber() });
      this.getMyPatents(count.toNumber());
      return this.state.usersInstance.getNumFolders.call(this.state.web3.eth.accounts[0]);
    }).then(count => {
      this.setState({ numFolders: count.toNumber() });
      this.getMyFolders(count.toNumber());
    }).catch(() => this.setState({ usersInstance: null }));
  }

  /*Buttons to scroll through documents*/
  prevPatent() {
    if (this.state.selectedPatent && this.state.selectedPatent.index > 0) {
      if (this.state.selectedPatent.isFolder) {
        this.setState({selectedPatent: this.state.folder[this.state.selectedPatent.index - 1]})
      } else {
        this.setState({selectedPatent: this.state.patents[this.state.selectedPatent.index - 1]})
      }
    }
  }

  nextPatent() {
    if (this.state.selectedPatent) {
      if (this.state.selectedPatent.isFolder) {
        if (this.state.selectedPatent.index < this.state.numFolders - 1) {
          this.setState({selectedPatent: this.state.folders[this.state.selectedPatent.index + 1]})
        }
      } else if (this.state.selectedPatent.index < this.state.numPatents - 1) {
        this.setState({selectedPatent: this.state.patents[this.state.selectedPatent.index + 1]})
      }
    }
  }

  /*--------------------------------- USER INTERFACE COMPONENTS ---------------------------------*/

  /*Button toolbar to scroll through documents*/
  buttonToolbar() {
    const isFolder = this.state.selectedPatent.isFolder;
    const maxIndex = (this.state.selectedPatent.isFolder ? this.state.numFolders : this.state.numPatents) - 1;
    return (
      <ButtonGroup justified>
        <ButtonGroup>
          <Button onClick={this.prevPatent} disabled={this.state.selectedPatent.index === 0}>
            <Glyphicon glyph="menu-left"/>{' Prev ' + (isFolder ? 'Folder' : 'File')}
          </Button>
        </ButtonGroup>
        <ButtonGroup>
          <Button onClick={() => this.hideDetails()}>
            <Glyphicon glyph="triangle-top"/> Hide Details <Glyphicon glyph="triangle-top"/>
          </Button>
        </ButtonGroup>
        <ButtonGroup>
          <Button onClick={this.nextPatent} disabled={this.state.selectedPatent.index === maxIndex}>
            {'Next ' + (isFolder ? 'Folder ' : 'File ')}<Glyphicon glyph="menu-right"/>
          </Button>
        </ButtonGroup>
      </ButtonGroup>);
  }


  /*Renders the details of a selected patent*/
  renderDetails() {
    return (
        <div className="requests-container">
          {this.buttonToolbar()}
          <FileManager web3={this.state.web3} patent={this.state.selectedPatent} gasPrice={this.state.gasPrice}
                       patentsInstance={this.state.patentsInstance} requestsInstance={this.state.requestsInstance} />
        </div>
    );
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
  renderPatentsTable() {
    if (this.state.numPatents > 0) {
      const header = (
        <tr>
          <th>Patent Name</th>
          <th>Submission Date</th>
          <th>Pending requests</th>
          <th>Ratings</th>
          <th>Average rating</th>
        </tr>
      );
      const table = this.state.patents
        .sort((p1, p2) => p1.pendingRequesters.length < p2.pendingRequesters.length ? 1 : -1)
        .map(patent => {
          const nRatings = patent.rates.length;
          return (
            <tr key={patent.id} onClick={this.openDetails.bind(this, patent)}>
              <td>{patent.name}</td>
              <td>{stampToDate(patent.timestamps[0])}</td>
              <td>{patent.pendingRequesters.length}</td>
              <td>{nRatings}</td>
              <td>{nRatings === 0 ? '-' : patent.rates.reduce((a, b) => a + b, 0) / nRatings + ' / 5'}</td>
            </tr>
          )
        });
      return (
        <Table striped hover responsive>
          <thead>{header}</thead>
          <tbody>{table}</tbody>
        </Table>
      );
    } else {
      return <div className='not-found'><h3>You do not have any deposited files on this network</h3></div>
    }
  }

  /*Returns a full table with folders*/
  renderFoldersTable() {
    if (this.state.numFolders > 0) {
      const header = (
        <tr>
          <th>Folder Name</th>
          <th>Submission Date</th>
          <th>Pending requests</th>
          <th>Ratings</th>
          <th>Average rating</th>
        </tr>
      );
      const table = this.state.folders
        .sort((p1, p2) => p1.pendingRequesters.length < p2.pendingRequesters.length ? 1 : -1)
        .map(folder => {
          const nRatings = folder.rates.length;
          return (
            <tr key={folder.id} onClick={this.openDetails.bind(this, folder)}>
              <td>{folder.name}</td>
              <td>{stampToDate(folder.timestamps[0])}</td>
              <td>{folder.pendingRequesters.length}</td>
              <td>{nRatings}</td>
              <td>{nRatings === 0 ? '-' : folder.rates.reduce((a, b) => a + b, 0) / nRatings + ' / 5'}</td>
            </tr>
          )
        });
      return (
        <Table striped hover responsive>
          <thead>{header}</thead>
          <tbody>{table}</tbody>
        </Table>
      );
    } else {
      return <div className='not-found'><h3>You do not have any deposited folders on this network</h3></div>
    }
  }

  /*Rendering function of the component*/
  render() {
    const patents = this.state.patentsInstance;
    const requests = this.state.requestsInstance;
    const users = this.state.usersInstance;
    if (patents === null || requests === null || users === null) {
      return <ContractNotFound/>;
    } else {
      return (
        <Grid>
          <Row bsClass='contract-address'>
            Patents contract at {patents.address} <br/>
            Requests contract at {requests.address} <br/>
            Users contract at {users.address}
            <br/><br/>
            Current account {this.state.web3.eth.accounts[0]} (From Metamask)
            <br/>
            {!this.state.currentAccountRegistered && "Your current Metamask account is not registered. Please "}
            <a href="/registerArtist">{!this.state.currentAccountRegistered && "register it here"}</a>
            {!this.state.currentAccountRegistered && " to deposit patents"}
          </Row>
          <Row>
            {!this.state.selectedPatent && this.renderFoldersTable()}
            {!this.state.selectedPatent && this.renderPatentsTable()}
            {this.state.selectedPatent && this.renderDetails()}
          </Row>
        </Grid>
      );
    }
  }
}

const MyFiles = wrapWithMetamask(MyFiles_class, MyFiles_class.header());
export default MyFiles
