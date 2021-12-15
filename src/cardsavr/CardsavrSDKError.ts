export default class CardsavrSDKError extends Error {

  errors: any[];
  type: string;

  constructor(errors : any[], message = "JS Library Error") {
    super(message); 
    this.errors = errors;
    this.type = "CardsavrSDKError";

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CardsavrSDKError);
    }

    Object.setPrototypeOf(this, CardsavrSDKError.prototype);
  }

}
