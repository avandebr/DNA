import '../css/Pages.css'
import React, {Component} from 'react';
import {Table, Grid, Row} from 'react-bootstrap';
import {
  ContractNotFound,
  FieldGroup,
  LicenceSelector,
  SubmitButton
} from '../utils/FunctionalComponents';
import {stampToDate, successfullTx, validateEmail, validateEmails} from '../utils/UtilityFunctions';
import { Constants, RequestStatus} from '../utils/Constants';
import Patents from '../../build/contracts/Patents';
import Requests from '../../build/contracts/Requests';
import wrapWithMetamask from '../MetaMaskWrapper'
import MuiDialog from '@material-ui/core/Dialog';
import {generatePrivateKey, generatePublicKey} from '../utils/KeyGenerator'
import {ALREADY_REQUESTED, NOT_REQUESTABLE, ALREADY_OWNER, KEY_GENERATION_ERROR, contractError} from '../utils/ErrorHandler'
import Divider from "@material-ui/core/Divider";
import Paper from "@material-ui/core/Paper";

// TODO: put licence with status and allow to make new request even if accepted (and pending ?)
/*Component for requesting access to a patent*/
class Store_class extends Component {

  /*Constructor Method, initializes the State*/
  constructor(props) {
    super(props);
    this.state = {
      web3: props.web3,
      patentsInstance: null,
      requestsInstance: null,
      selectedPatent: null,
      numPatents: 0,
      numFolders: 0,
      patents: [],
      folders: [],
      gasPrice : 0,
      showRequestForm: false,
      email: '',
      repeat_email: '',
      requestedLicence: 1,
      waitingTransaction: false,
    };
    this.getPatents = this.getPatents.bind(this);
    this.handleChange = this.handleChange.bind(this);
  }

  /*Method called before the component is mounted, initializes the contract and the page content*/
  componentDidMount() {
    this.state.web3.eth.getGasPrice((err, res) => this.setState({gasPrice : res.toNumber()}));
    const contract = require('truffle-contract');

    const requests = contract(Requests);
    requests.setProvider(this.state.web3.currentProvider);
    requests.at(Constants.CONTRACT_ADDRESS.requests).then(instance => { // for ROPSTEN
    // requests.deployed().then(instance => {
      this.setState({ requestsInstance: instance });
    }).catch(() => this.setState({ requestsInstance: null }));

    const patents = contract(Patents);
    patents.setProvider(this.state.web3.currentProvider);
    patents.at(Constants.CONTRACT_ADDRESS.patents).then(instance => { // for ROPSTEN
    // patents.deployed().then(instance => {
      this.setState({ patentsInstance: instance });
      return instance.patentCount.call();
    }).then(count => {
      this.setState({ numPatents: count.toNumber() });
      this.getPatents(count.toNumber());
      return this.state.patentsInstance.folderCount.call()
    }).then(count => {
      this.setState({ numFolders: count.toNumber() });
      this.getFolders(count.toNumber());
    }).catch(console.log);

    // to refresh displayed account
    this.state.web3.currentProvider.on('accountsChanged', () => this.setState({}));
  }

  validateEmail = () => validateEmail(this.state.email);
  validateEmails = () => validateEmails(this.state.email, this.state.repeat_email);

  /*Returns True if all form validation pass*/
  validateForm() {
    return this.validateEmail() === 'success'
      && this.validateEmails() === 'success'
      && this.selectedPatent !== null;
  }

  closeForm() {
    this.setState({ showRequestForm: false });
    this.resetForm()
  }

  resetForm() {
    this.setState({
      email: '',
      repeat_email: '',
      requestedLicence: 1,
      selectedPatent: null,
      waitingTransaction: false,
    })
  }

  resetPatents() {
    setTimeout(() => {
      this.setState({ patents: [], folders: [] });
      this.getPatents(this.state.numPatents);
      this.getFolders(this.state.numFolders);
    }, 3000)
  }

  handleChange(e) {
    e.preventDefault();
    this.setState({ [e.target.name]: e.target.value });
  }

  /*Fetches one given patent from the smart contract*/
  loadPatent(id) {
    const patents = this.state.patentsInstance;
    const requests = this.state.requestsInstance;
    return new Promise((resolve, reject) => {
      let patent = { id };
      patents.getPatentOwner.call(patent.id).then(owner => {
        patent['ownerAddress'] = owner;
        return patents.getTimestamp.call(patent.id, 0)
      }).then(timestamp => {
        patent['timestamp'] = timestamp.toNumber();
        return patents.getPatentName.call(patent.id);
      }).then(name => {
        patent['name'] = name;
        return patents.getOwnerName.call(patent.id);
      }).then(name => {
        patent['ownerName'] = name;
        return requests.getRequestStatus.call(patent.id, this.state.web3.eth.accounts[0]);
      }).then(status => {
        patent['status'] = status.toNumber();
        return patents.getMaxLicence.call(patent.id);
      }).then(maxLicence => {
        patent['maxLicence'] = maxLicence.toNumber();
        patent['rates'] = [];
        return patents.getNumRequests.call(patent.id);
      }).then(numRequests => {
        for (let j = 0; j < numRequests.toNumber(); j++) {
          patents.getBuyers.call(patent.id, j).then(userID => {
            return patents.getRate.call(patent.id, userID);
          }).then(rate => {
            if (rate > 0) {
              patent.rates.push(rate.toNumber());
            }
          })
        }
        return patents.isDeleted.call(patent.id);
      }).then(isDeleted => {
        patent['deleted'] = isDeleted;
        return patents.getPrices.call(patent.id);
      }).then(prices => {
        patent['prices'] = prices.map(price => price.toNumber());
        return Promise.all(prices.map(price => patents.getEthPrice(price)));
      }).then(ethPrices => {
        patent['ethPrices'] = ethPrices.map(price => price.toNumber());
        resolve(patent);
      }).catch(reject);
    })
  }

  /*Function that gets all patent information form the contract and stores them in the state*/
  getPatents(numPatents) {
    const patents = this.state.patentsInstance;
    const requests = this.state.requestsInstance;
    if (patents !== null && requests !== null) {
      for (let i = 0; i < numPatents; i++) {
        patents.patentIDs.call(i).then(id => {
          return this.loadPatent(id);
        }).then(patent => {
          let patents = this.state.patents;
          patents.push(patent);
          this.setState({ patents });
        }).catch(contractError);
      }
    }
  }

  /*Function that gets all folders information form the contract and stores them in the state*/
  getFolders(numFolders) {
    const patents = this.state.patentsInstance;
    const requests = this.state.requestsInstance;
    if (patents !== null && requests !== null) {
      for (let i = 0; i < numFolders; i++) {
        patents.folderIDs.call(i).then(id => {
          return this.loadPatent(id);
        }).then(folder => {
          patents.getFolderSize.call(folder.id).then(numPatents => {
            Promise.all([...new Array(numPatents.toNumber()).keys()].map(j => {
              return patents.getPatentID.call(folder.id, j);
            })).then(patentIDs => {
              folder['patentIDs'] = patentIDs;
              Promise.all(patentIDs.map(patentID => {
                return patents.getPatentName.call(patentID);
              })).then(names => {
                folder['patentNames'] = names;
                let folders = this.state.folders;
                folders.push(folder);
                this.setState({ folders });
              });
            });
          });
        }).catch(console.log);
      }
    }
  }

  /*--------------------------------- EVENT HANDLERS ---------------------------------*/

  promptInformartions(patent) {
    if (patent.ownerAddress !== this.state.web3.eth.accounts[0]) {
      if (patent.maxLicence > 0) {
        this.state.requestsInstance.canRequest.call(patent.id, 1, this.state.web3.eth.accounts[0]).then(canRequest => {
          if (canRequest && patent.status === RequestStatus.NOT_REQUESTED) {
            this.setState({showRequestForm: true, selectedPatent: patent})
          } else {
            window.dialog.showAlert(ALREADY_REQUESTED)
          }
        })
      } else {
        window.dialog.showAlert(NOT_REQUESTABLE);
      }
    } else {
      window.dialog.showAlert(ALREADY_OWNER);
    }
  }

  /*Function that initiates the contract call and creates a request*/
  // requestAccess(selectedPatent, requestedLicence, email) {
  requestAccess(e) {
    e.preventDefault();
    const { selectedPatent, requestedLicence, email } = this.state;
    if (email === ''){
      window.dialog.showAlert("Your email is needed to receive notifications");
    }
    else if (email.match(/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/) !== null){
      this.setState({ waitingTransaction: true });
      generatePrivateKey(this.state.web3, selectedPatent.id).then(key => {
        let publicKey = generatePublicKey(key); // Generate public key associated to this private key
        return this.state.requestsInstance.requestAccess(selectedPatent.id, requestedLicence, publicKey, email, {
          from: this.state.web3.eth.accounts[0],
          value: selectedPatent.ethPrices[requestedLicence-1],
          gas: process.env.REACT_APP_GAS_LIMIT,
          gasPrice : this.state.gasPrice
        });
      }).then(tx => {
        this.closeForm();
        successfullTx(tx);
        this.resetPatents();
      }).catch(err => {
        if (err === KEY_GENERATION_ERROR){
          window.dialog.showAlert(KEY_GENERATION_ERROR)
        } else {
          contractError(err);
        }
      });
    } else {
      window.dialog.showAlert("Please enter a valid email address")
    }
  }

  /*--------------------------------- USER INTERFACE COMPONENTS ---------------------------------*/

  /*Header for the Component, For the Metamask wrapper*/
  static header() {
    return (
      <Grid>
        <br/>
        <Row bsClass='title'>Files Store</Row>
        <hr/>
        <Row bsClass='paragraph'>
          <p>This page allows users that have an Ethereum account and are using it on the Metamask
            extension for browsers, to request access to files deposited by other users. <br/>To request a certain file,
            simply click on the row.<br/><br/>
            The owner will have to accept your request for you to be able to decrypt the document.
            <br/>You only need to <b>unlock your Metamask extension</b> and choose the document you want to access.
          </p>
        </Row>
      </Grid>
    );
  }

  renderRequestForm() {
    return (
      <Paper style={{ padding: 20 }}>
        <form onSubmit={e => this.requestAccess(e)}>
          <LicenceSelector prices={this.state.selectedPatent.prices}
                           onLicenceChange={e => this.handleChange(e)} />
          <FieldGroup name="email" id="formsControlsEmail" label="Email address" type="email"
                      value={this.state.email} placeholder="john@doe.com"
                      help={"So we can send you notifications regarding this request"}
                      validation={this.validateEmail()} onChange={this.handleChange} />
          <FieldGroup name="repeat_email" id="formsControlsEmail" label="Repeat Email address" type="email"
                      value={this.state.repeat_email} placeholder="john@doe.com" help=""
                      validation={this.validateEmails()}
                      onChange={this.handleChange}/>
          <Divider/><br/>
          <SubmitButton running={this.state.waitingTransaction} disabled={!this.validateForm()}/>
        </form>
      </Paper>
    );
  }

  /*Returns a table row for the given patent*/
  getPatentRow(patent) {
    const isOwner = (patent.ownerAddress === this.state.web3.eth.accounts[0]);
    const nRatings = patent.rates.length;
    return (
      <tr key={patent.id} onClick={this.promptInformartions.bind(this, patent)}>
        <td>{patent.name}</td>
        <td>{isOwner ? 'You' : patent.ownerName /* + ' (' + patent.ownerAddress + ')' */}</td>
        <td>{stampToDate(patent.timestamp)}</td>
        <td>{nRatings}</td>
        <td>{nRatings === 0 ? '-' :patent.rates.reduce((a, b) => a + b, 0) / nRatings + ' / 5'}</td>
      </tr>
    );
  }

  /*Returns a full table with patents*/
  renderPatentsTable() {
    // TODO: hide patents with only licence 0 ?
    const patentsToDisplay = this.state.patents
      .filter(p => !p.deleted && p.maxLicence > 0)
      .sort((p1, p2) => p1.name < p2.name ? -1 : 1);
    if (patentsToDisplay.length > 0) {
      const table = patentsToDisplay.map(patent => this.getPatentRow(patent));
      let header = (
        <tr>
          <th>File Name</th>
          <th>Owner</th>
          <th>Submission Date</th>
          <th>Number of Ratings</th>
          <th>Average Rating</th>
        </tr>
      );
      return (
        <Table striped hover responsive>
          <thead>{header}</thead>
          <tbody>{table}</tbody>
        </Table>
      );
    } else {
      return <div className='not-found'><h3>There are no deposited files on this Network</h3></div>
    }
  }

  /*Returns a table row for the given patent*/
  getFolderRow(folder) {
    const isOwner = (folder.ownerAddress === this.state.web3.eth.accounts[0]);
    return (
      <tr key={folder.id} onClick={this.promptInformartions.bind(this, folder)}>
        <td>{folder.name}</td>
        <td>{isOwner ? 'You' : folder.ownerName /* + ' (' + patent.ownerAddress + ')' */}</td>
        <td>{stampToDate(folder.timestamp)}</td>
        <td>{folder.patentNames.map((name, i) => name + (i < folder.patentNames.length-1 ? ', ' : ''))}</td>
      </tr>
    );
  }

  /*Returns a full table with patents*/
  renderFoldersTable() {
    const foldersToDisplay = this.state.folders
      .filter(f => !f.deleted)
      .sort((p1, p2) => p1.name < p2.name ? -1 : 1);
    if (foldersToDisplay.length > 0) {
      const table = foldersToDisplay.map(folder => this.getFolderRow(folder));
      let header = (
        <tr>
          <th>Folder Name</th>
          <th>Owner</th>
          <th>Submission Date</th>
          <th>Content</th>
        </tr>
      );
      return (
        <Table striped hover responsive>
          <thead>{header}</thead>
          <tbody>{table}</tbody>
        </Table>
      );
    } else {
      return <div className='not-found'><h3>There are no deposited folders on this Network</h3></div>
    }
  }

  /*Rendering function of the component*/
  render() {
    if (this.state.patentsInstance === null || this.state.requestsInstance === null ) {
      return <ContractNotFound/>;
    } else {
      return (
        <div>
          <Grid>
            <Row bsClass='contract-address'>
              Patents contract at {this.state.patentsInstance.address} <br/>
              Requests contract at {this.state.requestsInstance.address} <br/>
              <br/> Current account {this.state.web3.eth.accounts[0]} (From Metamask)
            </Row>
            <Row>
              {this.renderFoldersTable()}
              {this.renderPatentsTable()}
            </Row>
          </Grid>
          <MuiDialog disableEnforceFocus open={this.state.showRequestForm} onClose={() => this.closeForm()}>
            {this.state.showRequestForm && this.renderRequestForm()}
          </MuiDialog>
        </div>
      );
    }
  }
}

const Store = wrapWithMetamask(Store_class, Store_class.header());
export default Store
