/// <reference types="node" />
import * as crypto from 'crypto';
export declare namespace WebConversions {
    const arrayBufferToBase64: (arrayBuffer: any) => string;
    const base64ToArrayBuffer: (b64string: string) => ArrayBuffer | SharedArrayBuffer;
    const stringToArrayBuffer: (string: string) => Uint8Array;
}
export declare namespace Encryption {
    const encryptRequest: (key: string, body: Object) => Promise<{
        encryptedBody: string;
    }>;
    const encryptAES256: (b64Key: string, clearText: string) => {
        encryptedBody: string;
    };
    const decryptResponse: (key: string, body: any) => Promise<any>;
    const decryptAES256: (b64cipherText: string, b64IV: string, b64Key: string) => any;
}
export declare namespace Signing {
    const sha256Hash: (inputString: string) => Buffer;
    const signRequest: (path: string, appName: string, sessionKey: string, body?: any) => Promise<{
        authorization: string;
        nonce: string;
        signature: string;
    }>;
    const verifySignature: (url: string, headers: any, b64appKey: string, body: any) => Promise<boolean>;
    const signSaltWithPasswordKey: (sessionSalt: string, passwordKey: string) => Promise<string>;
    const hmacSign: (inputString: any, b64Key: string, b64InputString?: boolean) => Promise<string>;
    const hmacVerify: (inputString: string, b64Key: string, verificationSignature: string) => Promise<boolean>;
}
export declare namespace Keys {
    const generatePasswordKey: (userName: string, clearTextPassword: string) => Promise<string>;
    const generateCardholderSafeKey: (username: string) => string;
    const makeECDHkeyPair: () => crypto.ECDH;
    const makeECDHPublicKey: (myKeyPair: any) => any;
    const makeECDHSecretKey: (b64serverPublicKey: any, myKeyPair: any) => any;
    const sha256pbkdf2: (clearTextPassword: string, salt: any, rounds: number) => Buffer;
}
