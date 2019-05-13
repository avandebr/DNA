/*Set of React Components that are reused and are functional*/

import React from 'react'
import { Form, FormControl, FormGroup, ControlLabel, HelpBlock, Alert, Checkbox } from 'react-bootstrap'
import Button from 'react-bootstrap-button-loader'
import '../css/Pages.css'
import {stampToDate} from './UtilityFunctions'
import {FileStates} from "./Constants";
import licences from './Licences'

/* encryption button component for file uploading form */
const EncryptFileButton = (props) => {
  let buttonState, buttonText;
  const files = 'File' + (props.multiple ? 's' : '');
  switch (props.fileState) {
    case FileStates.NOT_ENCRYPTED:
      buttonState = "default";
      buttonText = "Encrypt " + files;
      break;
    case FileStates.ENCRYPTING:
      buttonState = "default";
      buttonText = "Encrypting " + files + "...";
      break;
    case FileStates.ENCRYPTED:
      buttonState = "success";
      buttonText = files + " encrypted";
      break;
    default:
      break;
  }
  return (
    <Button bsStyle={buttonState}
            loading={props.fileState === FileStates.ENCRYPTING}
            spinColor="#000"
            disabled={props.disabled}
            onClick={props.onClick}
            block>
      {buttonText}
    </Button>
  );
}


/*Submit button Component with loading state */
const SubmitButton = (props) => {
  return (
    <Button type='submit' spinColor="#000" loading={props.running} disabled={props.disabled} block>
      {props.running ? 'Sending' : 'Submit'}
    </Button>
  );
};


/*
* React Component for a FieldGroup (Form field with additional useful features)
* */
const FieldGroup = (props) => {
  return (
    <FormGroup controlId={props.id} validationState={props.validation} style={props.style}>
      {props.label && <ControlLabel>{props.label}</ControlLabel>}
      <FormControl name={props.name} type={props.type} value={props.value} placeholder={props.placeholder}
                   multiple={props.multiple} disabled={props.disabled} onChange={props.onChange} />
      <FormControl.Feedback/>
      {props.help && <HelpBlock>{props.help}</HelpBlock>}
    </FormGroup>
  );
};


/*
* Menu for licences selection while requesting
*/
const LicenceSelector = (props) => {
  return (
    <FormGroup controlId="exampleForm.ControlSelect1">
      <ControlLabel>Please select a licence</ControlLabel>
      <FormControl componentClass="select" name="requestedLicence" onChange={e => props.onLicenceChange(e)}>
        {Object.keys(licences).slice(1).map(i => {
          const disabled = i > props.prices.length || i <= (props.actualLicence || 0);
          return (
            <option disabled={disabled} value={i} key={`Licence ${i}`}>
              {`Licence ${i} (${disabled ? '-' : props.prices[i-1]} USD)`}
            </option>
          );
        })}
      </FormControl>
    </FormGroup>
  );
}


/*
* Menu for licences selection and price setting while depositing
*/
const LicencesMenu = (props) => {
  const licenceNumbers = Object.keys(licences);
  return (
    <div>
      {licenceNumbers.map(licence => (
        <div key={`licence ${licence} selector`}>
          <LicenceSelect licence={licence} disabled={licence==='0'} checked={licence <= props.licence}
                         onLicenceChange={props.onLicenceChange} onPricesChange={props.onPricesChange}
                         licencePrice={props.prices[licence]} validatePrice={props.validatePrice}/>
          {licence < licenceNumbers.length - 1 && <br/>}
        </div>
      ))}
    </div>
  );
};


/*
* Component for Licence selection and corresponding price
*/
const LicenceSelect = (props) => {
  return (
    <Form inline>
      <Checkbox checked={props.checked} onChange={() => props.onLicenceChange(props.licence)}> Licence {props.licence}</Checkbox>
      <FieldGroup name="price" id="formsControlsName" type="text" style={{ marginLeft: 20 }} value={props.licencePrice}
                  disabled={props.disabled || !props.checked} onChange={e => props.onPricesChange(props.licence, e.target.value)}
                  validation={props.validatePrice(props.licencePrice)}/>
    </Form>
  );
};


/*Simple component to display when contract is not deployed*/
const ContractNotFound = () => {
  return (
    <div className="not-found">
      <h3>Contract not found on this Network, please try another network</h3>
    </div>
  );
};


/*Represents the container that display the given timestamp from the given user*/
const StampContainer = (props) => {
  let container = "";
  if (props.timestamp !== 0) {
    let date = stampToDate(props.timestamp);
    container = <Alert bsStyle="success">Document timestamped on {date}<br/>by {props.user}</Alert>
  } else {
    container = <Alert bsStyle="danger">Document not found in Database</Alert>
  }
  return <div style={{marginTop: '20px', textAlign: 'center', marginBottom: '100px'}}>{container}</div>
};


module.exports = { EncryptFileButton, SubmitButton, FieldGroup, ContractNotFound, StampContainer, LicencesMenu, LicenceSelector };