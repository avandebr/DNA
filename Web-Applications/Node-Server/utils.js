const hash_regex= /\b[A-Fa-f0-9]{64}\b/;
const email_regex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
const CORRUPTED = 'Data is corrupted';
const NOT_FOUND = "No timestamp found in Database";
const NO_MATCH = 'Signature does not match';

/**
 * Class containing utility functions
 */
class utils {

    /**
     *
     * @param str: The string to be checked
     * @returns {boolean}: True if the given string str is an email address, false otherwise
     */
    static isEmail(str){
        return str !== undefined && str.match(email_regex) !== null;
    }

    /**
     *
     * @param str: The string to be checked
     * @returns {boolean}: True if the given string str is a hash, false otherwise
     */
    static isHash(str){
        return str !== undefined && str.match(hash_regex) !== null;
    }
}

module.exports = {
    utils, CORRUPTED, NOT_FOUND, NO_MATCH
};