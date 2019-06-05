/*Set of constants for the app*/
const Constants = {
  EMAIL: 'email',
  HASH: 'hash',
  NAME: 'name',
  POST: 'post',
  FILE: 'file',
  SIGNATURE: 'signature',
  MAX_FILE_SIZE: 20000000, //Max file size of 20 MB, to avoid crashing the app
  CONTRACT_ADDRESS: '0x3C0e803797A7E585f110e65810b9C3a35A2B22c4', // '0xf32235620Ce7aE274c377A27cD1a2F087c23a104'
};

const FileStates = {
  NOT_ENCRYPTED: 0,
  ENCRYPTING: 1,
  ENCRYPTED: 2
};

const RequestStatus = {
  NOT_REQUESTED: 0,
  PENDING: 1,
  REJECTED: 2,
  CANCELLED: 3,
  ACCEPTED: 4
};

/*Returns the string associated to the given status (Between 0 and 3)*/
const getStatusString = (status) => {
  switch (status) {
    case RequestStatus.NOT_REQUESTED:
      return "Not requested";
    case RequestStatus.PENDING:
      return "Pending";
    case RequestStatus.REJECTED:
      return "Rejected";
    case RequestStatus.CANCELLED:
      return "Cancelled";
    case RequestStatus.ACCEPTED:
      return "Accepted";
    default :
      return "";
  }
};

module.exports = {Constants, FileStates, RequestStatus, getStatusString};