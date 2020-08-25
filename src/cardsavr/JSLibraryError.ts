export default class JSLibraryError extends Error {

  validationErrors: string[] | null;
  otherErrors: string | null;

  constructor(validationErrors: string[] | null, otherErrors: string | null = null, message = "JS Library Error") {
    super(message); 
    this.validationErrors = validationErrors;
    this.otherErrors = otherErrors;
    Object.setPrototypeOf(this, JSLibraryError.prototype);
  }

}