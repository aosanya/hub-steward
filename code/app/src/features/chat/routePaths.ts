import { screen } from "../../app/screen";

export const chatPaths = {
  roomThreads: screen("/chat/:roomId/threads"),
  roomThread: screen("/chat/:roomId/:threadId"),
  ask: screen("/chat/:roomId/:threadId/asks/:askId"),
};
