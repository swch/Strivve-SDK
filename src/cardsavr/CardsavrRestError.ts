import CardsavrSessionResponse from "./CardsavrSessionResponse";

export default class CardsavrResetError extends Error {

    response: CardsavrSessionResponse;
    errors: string[];

    constructor(response: CardsavrSessionResponse) {
        super(`CardsavrResetError ${response.statusCode}: ${response.statusText}`); 
        this.response = response;
        this.errors = response.body?._errors;
        Object.setPrototypeOf(this, CardsavrResetError.prototype);
    }

}