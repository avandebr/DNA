import '../css/Pages.css'
import React, {Component} from 'react';
import {Button, ButtonGroup, Panel, Label} from 'react-bootstrap';
import {getStatusString, RequestStatus} from '../utils/Constants';
import {saveByteArray, successfullTx} from '../utils/UtilityFunctions';
import {privateKeyDecrypt} from '../utils/CryptoUtils'
import {contractError, KEY_GENERATION_ERROR, IPFS_ERROR, KEY_ERROR, ENCRYPTION_ERROR} from "../utils/ErrorHandler";

import {generatePrivateKey} from '../utils/KeyGenerator';
import MuiDialog from "@material-ui/core/Dialog";
import Paper from "@material-ui/core/Paper";
import {LicenceSelector, SubmitButton} from "../utils/FunctionalComponents";

/*Component that represents a single request and implements the actions based on the state*/

// TODO: Form to select a licence when re-sending a request
class RequestPanel extends Component {

  constructor(props) {
    super(props);
    this.bundle = props.bundle;
    this.state = {
      web3: props.web3,
      contractInstance: props.instance,
      request: props.request,
      displayForm: false,
      requestedLicence: props.request.acceptedLicence + 1,
      gasPrice : props.gasPrice
    };
    this.downloadCopy = this.downloadCopy.bind(this);
    this.cancelRequest = this.cancelRequest.bind(this);
    this.cancelUpgrade = this.cancelUpgrade.bind(this);
    this.selectLicence = this.selectLicence.bind(this);
  }

  handleChange(e) {
    e.preventDefault();
    this.setState({ [e.target.name]: e.target.value });
  }

  closeForm() {
    this.setState({ displayForm: false, requestedLicence: this.state.request.acceptedLicence + 1 });
  }

  /*To download a copy of the file if it is authorized*/
  downloadCopy() {
    let privateKey;
    let request = this.state.request;
    generatePrivateKey(this.state.web3, request.hash).then(pk => {
      privateKey = pk;
      return this.state.contractInstance.getEncryptedIpfsKey.call(request.patentName, {
        from: this.state.web3.eth.accounts[0]
      })
    }).then(encryptedKey => {
      return privateKeyDecrypt(encryptedKey, privateKey);
    }).then(aes_key => {
      window.dialog.showAlert("Download will start shortly");
      return this.bundle.getDecryptedFile(request.hash, request.ipfsLocation, aes_key);
    }).then(buffer => saveByteArray(request.patentName, buffer, window, document))
      .catch(e => {
        if (e === KEY_GENERATION_ERROR || e === KEY_ERROR || e === IPFS_ERROR || e === ENCRYPTION_ERROR) {
          window.dialog.showAlert(e)
        } else {
          contractError(e)
        }
      })
  }

  /* Show the form to upgrade the licence for a previously accepted request */
  selectLicence() {
    const request = this.state.request;
    if (request.status === RequestStatus.ACCEPTED) {
      if (request.acceptedLicence === request.patentMaxLicence) {
        window.dialog.showAlert('You already have access to the best licence for this file');
      } else {
        this.setState({displayForm: true});
      }
    } else if (request.status === RequestStatus.REJECTED || request.status === RequestStatus.CANCELLED) {
      this.setState({displayForm: true});
    }
  }

  /*Cancels a request*/
  cancelRequest() {
    let request = this.state.request;
    this.state.contractInstance.cancelRequest(request.patentName, {
      from: this.state.web3.eth.accounts[0],
      gas: process.env.REACT_APP_GAS_LIMIT,
      gasPrice : this.state.gasPrice
    }).then(tx => {
      successfullTx(tx);
      request.status = RequestStatus.CANCELLED;
      this.setState({ request });
    }).catch(e => contractError(e))
  }

  /*Cancels an upgrade request*/
  cancelUpgrade() {
    let request = this.state.request;
    this.state.contractInstance.cancelUpgrade(request.patentName, {
      from: this.state.web3.eth.accounts[0],
      gas: process.env.REACT_APP_GAS_LIMIT,
      gasPrice : this.state.gasPrice
    }).then(tx => {
      successfullTx(tx);
      request.status = RequestStatus.ACCEPTED;
      this.setState({ request });
    }).catch(e => contractError(e))
  }

  /*Resend a cancelled or rejected request*/
  resendRequest() {
    let { request, requestedLicence } = this.state;
    this.state.contractInstance.resendRequest(request.patentName, requestedLicence, {
      from: this.state.web3.eth.accounts[0],
      value: this.state.request.patentEthPrices[requestedLicence-1],
      gas: process.env.REACT_APP_GAS_LIMIT,
      gasPrice : this.state.gasPrice
    }).then(tx => {
      successfullTx(tx);
      request.status = RequestStatus.PENDING;
      request.requestedLicence = requestedLicence;
      this.setState({ request });
    }).catch(e => contractError(e))
  }

  requestUpgrade() {
    let { request, requestedLicence, acceptedLicence } = this.state;
    if (requestedLicence > request.acceptedLicence) {
      this.state.contractInstance.requestUpgrade(request.patentName, requestedLicence, {
        from: this.state.web3.eth.accounts[0],
        value: request.patentEthPrices[requestedLicence-1] - request.patentEthPrices[acceptedLicence-1],
        gas: process.env.REACT_APP_GAS_LIMIT,
        gasPrice : this.state.gasPrice
      }).then(tx => {
        this.closeForm();
        successfullTx(tx);
        request.status = RequestStatus.PENDING;
        request.requestedLicence = requestedLicence;
        this.setState({ request });
      }).catch(err => {
          contractError(err);
      });
    } else {
      window.dialog.showAlert('Invalid selected licence')
    }
  }

  handleFormSubmit(e) {
    e.preventDefault();
    if (this.state.request.acceptedLicence > 0) {
      this.requestUpgrade();
    } else {
      this.resendRequest();
    }
    this.closeForm();
  }

  renderForm() {
    return (
      <Paper style={{ padding: 20 }}>
        <form onSubmit={e => this.handleFormSubmit(e)}>
          <LicenceSelector prices={this.state.request.patentPrices} actualLicence={this.state.request.acceptedLicence}
                           onLicenceChange={e => this.handleChange(e)} />
          <SubmitButton/>
        </form>
      </Paper>
    );
  }

  /*Buttons depending on the state of the request*/
  getButtons() {
    const request = this.state.request;
    let button = "";
    switch (request.status) {
      case RequestStatus.PENDING:
        button = this.state.request.acceptedLicence > 0
          ? <Button onClick={this.cancelUpgrade}>Cancel and Refund</Button>
          : <Button onClick={this.cancelRequest}>Cancel and Refund</Button>;
        break;
      case RequestStatus.CANCELLED:
      case RequestStatus.REJECTED:
        button = <Button onClick={this.selectLicence}>Resend a Request</Button>;
        break;
      case RequestStatus.ACCEPTED:
        button = <Button onClick={this.downloadCopy}>Download Copy</Button>;
        break;
      default:
        break
    }
    const contactButton = <Button onClick={() => open('mailto:'+request.ownerEmail)}>Contact Owner</Button>;
    const upgradeLicenceButton = <Button onClick={this.selectLicence}>Request Licence Upgrade </Button>;
    const isAccepted = (request.status === RequestStatus.ACCEPTED);
    return (
      <ButtonGroup justified>
        <ButtonGroup>{button}</ButtonGroup>
        <ButtonGroup>{contactButton}</ButtonGroup>
        {isAccepted && <ButtonGroup>{upgradeLicenceButton}</ButtonGroup>}
      </ButtonGroup>
    );
  }

  /*Label that represents state of the request*/
  getLabel() {
    let labelStyle = "default";
    switch (this.state.request.status) {
      case RequestStatus.ACCEPTED:
        labelStyle = "success";
        break;
      case RequestStatus.CANCELLED:
        labelStyle = "warning";
        break;
      case RequestStatus.REJECTED:
        labelStyle = "danger";
        break;
      default:
        break;
    }
    return (
      <Label bsStyle={labelStyle} className="pull-right">
        {getStatusString(this.state.request.status)}
      </Label>
    );
  }

  getDisplayedLicence() {
    return this.state.request.status === RequestStatus.ACCEPTED
      ? this.state.request.acceptedLicence
      : this.state.request.requestedLicence;
  }

  render() {
    return (
      <div>
        <Panel eventKey={this.state.request.id} key={this.state.request.patentName}>
          <Panel.Heading>
            <Panel.Title toggle>
              {this.state.request.patentName} - Licence {this.getDisplayedLicence()}
              {this.getLabel()}
            </Panel.Title>
          </Panel.Heading>
          <Panel.Body collapsible>{this.getButtons()}</Panel.Body>
        </Panel>
        <MuiDialog disableEnforceFocus open={this.state.displayForm} onClose={() => this.closeForm()}>
          {this.state.displayForm && this.renderForm()}
        </MuiDialog>
      </div>
    );
  }
}

export default RequestPanel