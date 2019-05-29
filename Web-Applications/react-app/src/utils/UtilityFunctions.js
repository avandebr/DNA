/*Set of utility functions used multiple times */

import {LARGE_FILE} from "./ErrorHandler";
import {Constants} from "./Constants";
import Dialog from 'react-bootstrap-dialog'

const EMAIL_REGEX = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;

/*Function that triggers the download of the given bytes*/
const saveByteArray = (name, bytes, window, document) => {
  let blob = new Blob([bytes]);
  let link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.download = name;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/*Utility function that extracts the json from a file and returns a promise that resolves into the json object,
* or is rejected if the parsing could not occur*/
const extractJson = (file, window) => {
  return new Promise(function (resolve, reject) {
    let f = file;
    if (typeof window.FileReader !== 'function') {
      reject('Browser does not support FileReader');
    }
    if (!f) {
      reject("Please select a file");
    } else if (f.type !== 'application/json') {
      reject('File is not a JSON')
    } else {
      let fr = new window.FileReader();
      fr.onload = function (data) {
        try {
          let tmp = data.target.result;
          JSON.parse(tmp);
          resolve(tmp)
        } catch (error) {
          reject('JSON file is corrupted')
        }
      };
      fr.readAsText(f);
    }
  })
};

/*Converts a unix timestamp to a String with date and time*/
const stampToDate = (timestamp) => {
  let date = new Date(timestamp * 1000);
  return date.toDateString() + " at " + date.toTimeString();
};

const successfullTx = (tx) => {
  window.dialog.show({
    title: "Successful Transaction",
    body: "Hash : " + tx.tx,
    bsSize: "large",
    actions: [
      Dialog.OKAction()
    ]
  });
};

/* Helper function that converts Wei to Ether*/
const toEther = (priceInWei, web3) => {
  if (web3 != null) {
    return web3.fromWei(priceInWei.toNumber(), 'ether');
  }
};

/*Helper function that converts Ether to Wei*/
const fromEther = (priceInEth, web3) => {
  if (web3 !== null) {
    return web3.toWei(priceInEth, 'ether');
  }
};

// ==================== Form fields validation functions ====================

/*Checks if Patent Name length is less than 100 */
const validateName = (name) => {
  let length = name.length;
  if (length === 0) {
    return null;
  } else if (length <= 100) {
    return "success"
  } else {
    return "error";
  }
};

/*Checks that price >= 0*/
const validatePrice = (price) => {
  if ((!price && price !== 0) || price === "") {
    return null;
  }
  const floatPrice = parseFloat(price);
  // ensure price not negative and is in float format
  return (floatPrice >= 0 && String(floatPrice) === String(price) ? 'success' : 'error');
};

/*Utility function to validate email*/
const validateEmail = (email) => {
  if (email === '') {
    return null;
  }
  return email.match(EMAIL_REGEX) !== null ? 'success' : 'error';
};

/*Utility function to validate emails*/
const validateEmails = (email, repeat) => {
  if (email === '' || repeat === '') {
    return null;
  }
  // (validateEmail(email) == 'success' &&
  return (email === repeat) ? 'success' : 'error';
};

/*Utility function that returns true if the file is valid*/
const validateFile = (file, showAlert=true) => {
  const nameSplit = file.name.split('.');
  let toAlert = '';
  if (showAlert) {
    if (!file) {
      toAlert += '- Please select a file';
    } else if (file.size > Constants.MAX_FILE_SIZE) {
      toAlert += '- ' + LARGE_FILE;
    }
    if (nameSplit.length !== 2 /* || nameSplit[1] !== 'mp3' */) {
      toAlert += "- Invalid file name: please ensure that the name does not contain '.' \n " +
        "and that the extension is one of the following: [mp3]";
    }
    if (toAlert) {
      window.dialog.showAlert(toAlert);
    }
  }
  return (file !== "" && file.size < Constants.MAX_FILE_SIZE)
    && (nameSplit.length === 2 /* && nameSplit[1] === 'mp3' */);
};

/*Utility function that returns true there are multiple files and all of them are valid*/
const validateFiles = (files, showAlert=true) => {
  if(files.length === 0) {
    window.dialog.showAlert('Please select files');
    return false;
  } else if (files.length === 1) {
    window.dialog.showAlert('Please select more than one file. \n ' +
      'For a single file deposit, \n please register it HERE (TBD href to song reg)');
    return false;
  }
  else if (files.length > 100) {
    window.dialog.showAlert('Maximum number of files (100) reached.');
    return false;
  }
  const validFiles = files.every(file => validateFile(file, false));
  if(!validFiles && showAlert) {
    window.dialog.showAlert('At least one the file is not valid. Click for more info... (TBD)');
  }
  return validFiles;
};

module.exports = {
  extractJson,
  saveByteArray,
  stampToDate,
  successfullTx,
  toEther,
  fromEther,
  validateName,
  validatePrice,
  validateFile,
  validateFiles,
  validateEmail,
  validateEmails,
};


