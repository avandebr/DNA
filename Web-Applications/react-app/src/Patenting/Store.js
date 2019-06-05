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
import {Constants, RequestStatus, getStatusString} from '../utils/Constants';
import Patenting from '../../build/contracts/Patenting';
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
      contractInstance: null,
      selectedPatent: null,
      numPatents: 0,
      patents: [],
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
    const patenting = contract(Patenting);
    patenting.setProvider(this.state.web3.currentProvider);
    // patenting.deployed().then(instance => {
    patenting.at(Constants.CONTRACT_ADDRESS).then(instance => { // for ROPSTEN
      this.setState({contractInstance: instance});
      return instance.patentCount.call()
    }).then(count => {
      this.setState({numPatents: count.toNumber()});
      this.getPatents(count.toNumber());
    }).catch(() => this.setState({contractInstance: null}));
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
      this.setState({patents: []});
      this.getPatents(this.state.numPatents)
    }, 3000)
  }

  handleChange(e) {
    e.preventDefault();
    this.setState({ [e.target.name]: e.target.value });
  }

  /*Function that gets all patent information form the contract and stores them in the state*/
  getPatents(numPatents) {
    if (this.state.contractInstance !== null) {
      const instance = this.state.contractInstance;
      for (let i = 0; i < numPatents; i++) {
        let new_entry = {};
        instance.patentIDs.call(i).then(id => {
          new_entry['id'] = id;
          return instance.getPatentOwner.call(new_entry['id']);
        }).then(owner => {
          new_entry['ownerAddress'] = owner;
          return instance.getTimeStamp.call(new_entry['id'])
        }).then(timestamp => {
          new_entry['timestamp'] = timestamp.toNumber();
          return instance.getPatentName.call(new_entry['id']);
        }).then(name => {
          new_entry['name'] = name;
          return instance.getOwnerName.call(new_entry['id']);
        }).then(name => {
          new_entry['ownerName'] = name;
          return instance.getRequestStatus.call(new_entry['id'], this.state.web3.eth.accounts[0]);
        }).then(status => {
          new_entry['status'] = status.toNumber();
          return instance.getMaxLicence.call(new_entry['id'])
        }).then(maxLicence => {
          new_entry['maxLicence'] = maxLicence.toNumber();
          return instance.isDeleted.call(new_entry['id'])
        }).then(isDeleted => {
          new_entry['deleted'] = isDeleted;
          return instance.getPrices.call(new_entry['id'])
        }).then(prices => {
          new_entry['prices'] = prices.map(price => price.toNumber());
          return Promise.all(prices.map(price => instance.getEthPrice(price)));
        }).then(ethPrices => {
          new_entry['ethPrices'] = ethPrices.map(price => price.toNumber()); // = 0 because integers
          let patents = this.state.patents;
          patents.push(new_entry);
          this.setState({ patents });
        }).catch(contractError);
      }
    }
  }

  /*--------------------------------- EVENT HANDLERS ---------------------------------*/


  promptInformartions(patent) {
    if (patent.ownerAddress !== this.state.web3.eth.accounts[0]) {
      if (patent.maxLicence > 0) {
        this.state.contractInstance.canRequest.call(patent.id, 1, this.state.web3.eth.accounts[0]).then(canRequest => {
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
      generatePrivateKey(this.state.web3, selectedPatent.id).then(key => { //Generate privateKey = ECDSA(sha3(sha256(file))
        let publicKey = generatePublicKey(key); // Generate public key associated to this private key
        return this.state.contractInstance.requestAccess(selectedPatent.id, requestedLicence, publicKey, email, {
          from: this.state.web3.eth.accounts[0],
          value: selectedPatent.ethPrices[requestedLicence-1],
          gas: process.env.REACT_APP_GAS_LIMIT,
          gasPrice : this.state.gasPrice
        });
      }).then(tx => {
        this.closeForm()
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
  getRow(patent) {
    const isOwner = (patent.ownerAddress === this.state.web3.eth.accounts[0]);
    return (
      <tr key={patent.name} onClick={this.promptInformartions.bind(this, patent)}>
        <td>{patent.name}</td>
        <td>{isOwner ? 'You' : patent.ownerName + ' (' + patent.ownerAddress + ')'}</td>
        <td>{stampToDate(patent.timestamp)}</td>
        <td>{isOwner || patent.maxLicence === 0 ? '-' : getStatusString(patent.status)}</td>
      </tr>
    );
  }

  /*Returns a full table with patents*/
  renderTable() {
    // TODO: hide patents with only licence 0
    const patentsToDisplay = this.state.patents.filter(p => !p.deleted);
    if (patentsToDisplay.length > 0) {
      let table = patentsToDisplay.map(patent => this.getRow(patent));
      let header = (
        <tr>
          <th>File Name</th>
          <th>Owner</th>
          <th>Submission Date</th>
          <th>Request Status</th>
        </tr>
      );
      return (
        <Table striped hover responsive className='patent-table'>
          <thead>{header}</thead>
          <tbody>{table}</tbody>
        </Table>)
    } else {
      return <div className='not-found'><h3>There are no deposited files on this Network</h3></div>
    }
  }

  /*Rendering function of the component*/
  render() {
    if (this.state.contractInstance === null) {
      return <ContractNotFound/>;
    } else {
      return (
        <div>¨
          <Grid>
            <Row bsClass='contract-address'>
              Contract at {this.state.contractInstance.address} <br/>
              <br/> Current account {this.state.web3.eth.accounts[0]} (From Metamask)
            </Row>
            <Row>{this.renderTable()}</Row>
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
