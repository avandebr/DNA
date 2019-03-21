/*Set of constants for the app*/
const Constants = {
  EMAIL: 'email',
  HASH: 'hash',
  NAME: 'name',
  POST: 'post',
  FILE: 'file',
  SIGNATURE: 'signature',
  MAX_FILE_SIZE: 20000000 //Max file size of 20 MB, to avoid crashing the app
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

const RequestStatus_String = {
  NOT_REQUESTED: "Not requested",
  PENDING: "Pending",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  ACCEPTED: "Accepted"
};

/*Returns the string associated to the given status (Between 0 and 3)*/
const getStatusString = (status) => {
  switch (status.toNumber()) {
    case RequestStatus.NOT_REQUESTED:
      return RequestStatus_String.NOT_REQUESTED;
    case RequestStatus.PENDING:
      return RequestStatus_String.PENDING;
    case RequestStatus.REJECTED:
      return RequestStatus_String.REJECTED;
    case RequestStatus.CANCELLED:
      return RequestStatus_String.CANCELLED;
    case RequestStatus.ACCEPTED:
      return RequestStatus_String.ACCEPTED;
    default :
      return ""
  }
}

module.exports = {Constants, FileStates, RequestStatus_String, RequestStatus, getStatusString};