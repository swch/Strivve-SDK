export default class CardsavrSessionResponse {

    statusCode: number;
    statusText: string;
    headers: any;
    body: any;
  
    constructor(statusCode: number, statusText: string, headers: any, body: any){
  
      this.statusCode = statusCode;
      this.statusText = statusText;
      this.headers = headers;
      this.body = body;
    }
};