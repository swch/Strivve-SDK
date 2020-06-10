export default class JSLibraryError extends Error {

  validationErrors: any;
  otherErrors: any;

  constructor(validationErrors: any, otherErrors: any, message: string = "JS Library Error") {
    super(message); 
    this.validationErrors = validationErrors;
    this.otherErrors = otherErrors;
    Object.setPrototypeOf(this, JSLibraryError.prototype);
  }

};