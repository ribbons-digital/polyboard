declare module 'ws' {
  import { EventEmitter } from 'node:events'

  export type RawData = string | Buffer | ArrayBuffer | Buffer[]

  export default class WebSocket extends EventEmitter {
    constructor(url: string | URL, protocols?: string | string[])
    send(data: string | Buffer): void
    close(): void
  }
}
