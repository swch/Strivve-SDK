export default class CardsavrSDKError extends Error {

  errors: string[]

  constructor(errors : string[], message = "JS Library Error") {
    super(message); 
    this.errors = errors;
    Object.setPrototypeOf(this, CardsavrSDKError.prototype);
  }

}