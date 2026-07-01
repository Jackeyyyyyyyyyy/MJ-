import { auth } from '../auth';
import { storage } from '../storage';
import { PasskeyCredentialSummary, User } from '../types';

type PasskeyOptions = {
  rememberDevice?: boolean;
};

type PublicKeyCredentialWithAvailability = typeof PublicKeyCredential & {
  isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>;
};

export function isPasskeySupported() {
  try {
    return Boolean(
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      window.isSecureContext &&
      window.PublicKeyCredential &&
      navigator.credentials?.create &&
      navigator.credentials?.get,
    );
  } catch {
    return false;
  }
}

export async function isPlatformPasskeyAvailable() {
  if (!isPasskeySupported()) return false;

  try {
    if (typeof window === 'undefined') return false;
    const checker = (window.PublicKeyCredential as PublicKeyCredentialWithAvailability)
      .isUserVerifyingPlatformAuthenticatorAvailable;
    return checker ? checker.call(window.PublicKeyCredential) : true;
  } catch {
    return false;
  }
}

function base64urlToArrayBuffer(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

function arrayBufferToBase64url(value: ArrayBuffer | Uint8Array | null) {
  if (!value) return '';

  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = '';

  for (let index = 0; index < bytes.byteLength; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeCredentialDescriptor(descriptor: any) {
  return {
    ...descriptor,
    id: base64urlToArrayBuffer(descriptor.id),
  };
}

function decodeRegistrationOptions(options: any): PublicKeyCredentialCreationOptions {
  const publicKey = options.publicKey || options;

  return {
    ...publicKey,
    challenge: base64urlToArrayBuffer(publicKey.challenge),
    user: {
      ...publicKey.user,
      id: base64urlToArrayBuffer(publicKey.user.id),
    },
    excludeCredentials: (publicKey.excludeCredentials || []).map(decodeCredentialDescriptor),
  };
}

function decodeLoginOptions(options: any): PublicKeyCredentialRequestOptions {
  const publicKey = options.publicKey || options;

  return {
    ...publicKey,
    challenge: base64urlToArrayBuffer(publicKey.challenge),
    allowCredentials: publicKey.allowCredentials?.map(decodeCredentialDescriptor),
  };
}

function assertPublicKeyCredential(credential: Credential | null): PublicKeyCredential {
  if (
    !credential ||
    typeof window === 'undefined' ||
    !window.PublicKeyCredential ||
    !(credential instanceof window.PublicKeyCredential)
  ) {
    throw new Error('没有拿到通行密钥凭证。');
  }

  return credential;
}

function serializeRegistrationCredential(credential: PublicKeyCredential) {
  const response = credential.response as AuthenticatorAttestationResponse;

  return {
    id: credential.id,
    rawId: arrayBufferToBase64url(credential.rawId),
    type: credential.type,
    response: {
      attestationObject: arrayBufferToBase64url(response.attestationObject),
      clientDataJSON: arrayBufferToBase64url(response.clientDataJSON),
      transports: response.getTransports?.() || [],
    },
  };
}

function serializeAssertionCredential(credential: PublicKeyCredential) {
  const response = credential.response as AuthenticatorAssertionResponse;

  return {
    id: credential.id,
    rawId: arrayBufferToBase64url(credential.rawId),
    type: credential.type,
    response: {
      authenticatorData: arrayBufferToBase64url(response.authenticatorData),
      clientDataJSON: arrayBufferToBase64url(response.clientDataJSON),
      signature: arrayBufferToBase64url(response.signature),
      userHandle: arrayBufferToBase64url(response.userHandle),
    },
  };
}

export async function registerPasskey(): Promise<PasskeyCredentialSummary> {
  if (!isPasskeySupported()) {
    throw new Error('当前浏览器或地址不支持通行密钥。');
  }

  const options = decodeRegistrationOptions(await storage.getPasskeyRegistrationOptions());
  const credential = assertPublicKeyCredential(await navigator.credentials.create({ publicKey: options }));
  return storage.verifyPasskeyRegistration(serializeRegistrationCredential(credential));
}

export async function loginWithPasskey(username?: string, options: PasskeyOptions = {}): Promise<User> {
  if (!isPasskeySupported()) {
    throw new Error('当前浏览器或地址不支持通行密钥。');
  }

  const requestOptions = decodeLoginOptions(await storage.getPasskeyLoginOptions(username));
  const credential = assertPublicKeyCredential(await navigator.credentials.get({ publicKey: requestOptions }));
  const session = await storage.verifyPasskeyLogin(serializeAssertionCredential(credential));
  return auth.acceptSession(session, options);
}
