export default class CardsavrSessionResponse {

    statusCode: number;
    statusText: string;
    headers: any;
    body: any;
    call: string;
  
    constructor(statusCode: number, statusText: string, headers: any, body: any, call: string){
  
      this.statusCode = statusCode;
      this.statusText = statusText;
      this.headers = headers;
      this.body = body;
      this.call = call;
    }
}