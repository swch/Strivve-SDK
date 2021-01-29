export default class CardsavrSDKError extends Error {

  errors: string[];
  type: string;

  constructor(errors : string[], message = "JS Library Error") {
    super(message); 
    this.errors = errors;
    this.type = "CardsavrSDKError";

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CardsavrSDKError)
    }

    Object.setPrototypeOf(this, CardsavrSDKError.prototype);
  }

}
