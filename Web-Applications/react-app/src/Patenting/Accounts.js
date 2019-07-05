import '../css/Pages.css'

import React, {Component} from 'react';
import {Grid, Row, Col} from 'react-bootstrap';
import { FieldGroup, SubmitButton, ContractNotFound } from '../utils/FunctionalComponents';
import {
  validateName,
  validateEmail,
  validateEmails,
} from '../utils/UtilityFunctions';

import wrapWithMetamask from '../MetaMaskWrapper'
import Users from '../../build/contracts/Users';

import {contractError} from '../utils/ErrorHandler'
import Dialog from 'react-bootstrap-dialog';
import Paper from "@material-ui/core/Paper";
import Divider from "@material-ui/core/Divider";
// import {Constants} from "../utils/Constants";

/*----------------------------------------------------- DONE -----------------------------------------------------*/

// TODO: fetch user id if already registered and check that different when submitting new information
// TODO: mail verification ??

/*Component for Patent Deposit*/
class Accounts_class extends Component {

  /*Component Constructor*/
  constructor(props) {
    super(props);
    this.state = {
      registered: false,
      name: "",
      email: "",
      repeat_email: "",
      web3: props.web3,
      contractInstance: null,
      waitingTransaction: false,
      gasPrice : 0
    };
    this.handleChange = this.handleChange.bind(this);
    this.submitForm = this.submitForm.bind(this);
  }

  /* Called before the component is mounted
  * Instantiates the contract and stores the price of a patent */
  componentDidMount() {
    this.state.web3.eth.getGasPrice((err, res) => this.setState({ gasPrice : res.toNumber() }));
    const contract = require('truffle-contract');
    const users = contract(Users);
    users.setProvider(this.state.web3.currentProvider);
    // users.at(Constants.CONTRACT_ADDRESS).then(instance => { // for ROPSTEN
    users.deployed().then(instance => { // for LOCAL RPC
      this.setState({contractInstance: instance});
      return instance.isRegistered.call(this.state.web3.eth.accounts[0]);
    }).then(registered => {
      this.setState({ registered });
    }).catch(error => console.log(error));
    this.state.web3.currentProvider.on('accountsChanged', accounts => {
      this.state.contractInstance.isRegistered.call(accounts[0]).then(registered => {
        this.setState({registered});
      })
    });
  }

  /*--------------------------------- HELPER METHODS AND VALIDATION ---------------------------------*/

  /*Resets the form*/
  resetForm() {
    this.setState({
      name: "",
      email: "",
      repeat_email: "",
      waitingTransaction: false
    })
  }

  // Component validation functions
  validateName = () => validateName(this.state.name);
  validateEmail = () => validateEmail(this.state.email);
  validateEmails = () => validateEmails(this.state.email, this.state.repeat_email);

  /*Returns True if all form validation pass*/
  validateForm() {
    return (this.validateName() === 'success'
      && this.validateEmail() === 'success'
      && this.validateEmails() === 'success'
    );
  }

  /*--------------------------------- EVENT HANDLERS ---------------------------------*/

  /* Handles the change in the form component
  * */
  handleChange(e) {
    e.preventDefault();
    this.setState({ [e.target.name]: e.target.value });
  }

  /*Function that triggers the contract call to register a new artist or modify its information*/
  submitForm(e) {
    e.preventDefault();
    const isRegistered = this.state.registered;
    const submit = isRegistered
      ? this.state.contractInstance.modifyAccount
      : this.state.contractInstance.registerAccount;
    if (this.validateForm()) {
      this.setState({waitingTransaction: true});
      const { name, email } = this.state;
      submit(name, email, {
        from: this.state.web3.eth.accounts[0],
        // could have to pay to register as an artist and not for each patent ?
        // value: this.state.etherPrice,
        gas: process.env.REACT_APP_GAS_LIMIT,
        gasPrice : this.state.gasPrice
      }).then(tx => {
        this.setState({ registered: true });
        this.resetForm();
        window.dialog.show({
          title: "Successful Transaction",
          body: (isRegistered
            ? "Thank you " + name + ". Your new information have been successfully updated"
            : "Welcome to DNA " + name + ". You can now register your patents.") +
              "\n Transaction hash : " + tx.tx,
          bsSize: "large",
          actions: [
            Dialog.OKAction()
          ]
        });
      }).catch(error => {
        this.resetForm();
        contractError(error); // Handles the error
      });
    }
  }

  /*--------------------------------- USER INTERFACE COMPONENTS ---------------------------------*/

  /*The header to be displayed*/
  static header() {
    return (
      <Grid>
        <br/>
        <Row bsClass='title'>Artist Registration</Row>
        <hr/>
        <Row bsClass='paragraph'>
          <p>Welcome to DNA. This page allows users that have an Ethereum account and are using it on the Metamask
            extension for browsers, to register their account.
            <br/> Once this is done, you will be able to deposit patents and share them with other users.
            <br/><br/>You only need to <b>unlock your Metamask extension</b> and select the account you want to register.
          </p>
        </Row>
      </Grid>
    );
  }

  /*Renders the form to deposit a patent*/
  renderForm() {
    return (
      <Paper style={{ padding: 20 }}>
        <form onSubmit={e => this.submitForm(e)}>
          <FieldGroup name="name" id="formsControlsName" label="Artist Name"
                      type="text" value={this.state.name} placeholder="John Doe"
                      validation={this.validateName()} onChange={this.handleChange} />
          <FieldGroup name="email" id="formsControlsEmail" label="Email address" type="email"
                      value={this.state.email} placeholder="john@doe.com" help=""
                      validation={this.validateEmail()} onChange={this.handleChange} />
          <FieldGroup name="repeat_email" id="formsControlsEmail" label="Repeat Email address" type="email"
                      value={this.state.repeat_email} placeholder="john@doe.com" help=""
                      validation={this.validateEmails()} onChange={this.handleChange}/>
          <Divider/><br/>
          <SubmitButton running={this.state.waitingTransaction} disabled={!this.validateForm()}/>
        </form>
      </Paper>
    );
  }

  render() {
    if (this.state.contractInstance === null) {
      return <ContractNotFound/>;
    } else {
      return (
        <Grid>
          <Row bsClass="contract-address">
            <Col xsHidden>Users contract at {this.state.contractInstance.address}</Col>
            <br/>
            <Col xsHidden>
              Current account {this.state.web3.eth.accounts[0]} (From Metamask)
              <br/>
              {this.state.registered
                ? "Selected account already registered. You can fill the form to modify your information or "
                : "Selected account not registered yet. Please fill the form to register"
              }
              <a href="/registerSong">{this.state.registered && "deposit a patent"}</a>
            </Col>
          </Row>
          <Row><Col sm={3} md={5} mdOffset={3} className="form">{this.renderForm()}</Col></Row>
        </Grid>
      )
    }
  }
}

const Accounts = wrapWithMetamask(Accounts_class, Accounts_class.header());
export default Accounts;
