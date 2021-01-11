import CardsavrSDKError from "./CardsavrSDKError";
import CardsavrSessionResponse from "./CardsavrSessionResponse";

export default class CardsavrRestError extends CardsavrSDKError {

    response: CardsavrSessionResponse;
    statusCode: number;
    statusText: string;

    constructor(response: CardsavrSessionResponse) {
        super(response.body?._errors, `CardsavrResetError ${response.statusCode}: ${response.statusText}`); 
        this.response = response;
        this.statusCode = response.statusCode;
        this.statusText = response.statusText;
        Object.setPrototypeOf(this, CardsavrRestError.prototype);
    }

}