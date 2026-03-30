declare module 'ws' {
  import { EventEmitter } from 'node:events'

  export type RawData = string | Buffer | ArrayBuffer | Buffer[]

  export default class WebSocket extends EventEmitter {
    constructor(url: string | URL, protocols?: string | string[])
    close(): void
    send(data: string | ArrayBuffer | Buffer): void
    on(
      event: 'open',
      listener: () => void,
    ): this
    on(
      event: 'message',
      listener: (data: RawData) => void,
    ): this
    on(
      event: 'close',
      listener: () => void,
    ): this
    on(
      event: 'error',
      listener: (error: Error) => void,
    ): this
  }
}
