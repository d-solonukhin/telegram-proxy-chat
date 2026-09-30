export type Credentials = {
  idInstance: string;
  apiTokenInstance: string;
  /** Absolute GREEN-API origin, for example https://4100.api.green-api.com */
  apiUrl: string;
};

export type Chat = {
  chatId: string;
  name: string;
  phoneNumber?: string;
  username?: string;
  createdAt: number;
};

export type MessageStatus = 'pending' | 'sent' | 'failed';

export type Message = {
  idMessage: string;
  chatId: string;
  text: string;
  /** Unix seconds. */
  timestamp: number;
  direction: 'in' | 'out';
  status: MessageStatus;
  error?: string;
};

export type InstanceState =
  | 'authorized'
  | 'notAuthorized'
  | 'blocked'
  | 'suspended'
  | 'starting'
  | 'pendingPassword'
  | 'pendingCode'
  | string;

export type NotificationBody = {
  typeWebhook?: string;
  timestamp?: number;
  idMessage?: string;
  stateInstance?: string;
  instanceData?: {
    typeInstance?: string;
  };
  senderData?: {
    chatId?: string;
    chatName?: string;
    sender?: string;
    senderName?: string;
    senderContactName?: string;
    senderPhoneNumber?: number | string;
    chatType?: string;
  };
  messageData?: {
    typeMessage?: string;
    textMessageData?: {
      textMessage?: string;
    };
    extendedTextMessageData?: {
      text?: string;
      textMessage?: string;
    };
  };
};

export type ParsedMessage = {
  idMessage: string;
  chatId: string;
  text: string;
  timestamp: number;
  direction: 'in' | 'out';
  name: string;
  phoneNumber?: string;
};

export type PollEvent =
  | { type: 'message'; message: ParsedMessage }
  | { type: 'state'; state: string };

export type CheckAccountResult = {
  exist: boolean;
  chatId: string;
  username?: string;
  phoneNumber?: string;
};
