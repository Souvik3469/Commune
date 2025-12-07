export interface OfferPayload {
  from: string;
  offer: RTCSessionDescriptionInit;
  video?: boolean;
}

export interface AnswerPayload {
  answer: RTCSessionDescriptionInit;
}

export interface CandidatePayload {
  candidate: RTCIceCandidateInit;
}

export type IncomingCall = {
  fromId: string;
  hasVideo: boolean;
  callerName: string;
  callerAvatar: string;
};
