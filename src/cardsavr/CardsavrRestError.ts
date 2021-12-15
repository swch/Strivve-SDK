import CardsavrSDKError from "./CardsavrSDKError";
import CardsavrSessionResponse from "./CardsavrSessionResponse";

export default class CardsavrRestError extends CardsavrSDKError {

    response: CardsavrSessionResponse;
    statusCode: number;
    statusText: string;

    constructor(response: CardsavrSessionResponse) {

        const errors = Array.isArray(response.body) ? 
            response.body?.map((obj: { _errors: any; }) => obj._errors) :
            response.body?._errors;
            
        super(errors, `CardsavrRestError ${response.statusCode}: ${response.statusText}`); 
        this.response = response;
        this.type = "CardsavrRestError";
        this.statusCode = response.statusCode;
        this.statusText = response.statusText;
        Object.setPrototypeOf(this, CardsavrRestError.prototype);
    }

}

/*
message
stack
type (CardsavrRestError)
response.body._errors
response.body[0]._errors  (messages, jobs)

Request hydration:
    errors
        [
            "", ""        
        ]
Plural post
    errors
        [
            {call, id?, index?, name, "message", entity_name, property_name}       
        ]
    
    Response.body._errors
    Response.body[0]._errors
*/