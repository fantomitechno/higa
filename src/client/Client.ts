import { APIChannel, APIMessage } from 'discord-api-types';
import { GatewayPresenceUpdateData } from 'discord-api-types/gateway';
import fetch from 'node-fetch';
import WebSocket from 'ws';
import { EventEmitter } from 'node:events';

class Client extends EventEmitter {
  private readonly token: string;
  public readonly intents: number;

  private ws: WebSocket = new WebSocket(
    'wss://gateway.discord.gg/?v=9&encoding=json'
  );
  private heartbeat_interval = 0;
  private hearbeat_responded = false;
  private connection_closed = false;
  private sequence_number: number | null = null;
  private session_id = '';

  constructor(token?: string, intents: (keyof typeof ClientIntents)[] = []) {
    super();
    if (!token) throw new Error('NO TOKEN PROVIDED');
    this.token = token;

    this.setupWebSocket();

    this.once('READY', () => {
      setInterval(() => {
        if (this.hearbeat_responded) {
          this.ws.send(
            JSON.stringify({
              op: 1,
              d: this.sequence_number
            })
          );
          this.hearbeat_responded = false;
        } else {
          this.ws.close();
          this.connection_closed = true;
          this.ws = new WebSocket(
            'wss://gateway.discord.gg/?v=9&encoding=json'
          );
          this.setupWebSocket();
        }
      }, this.heartbeat_interval);
    });
  }

  private async setupWebSocket() {
    this.ws.on('message', (data) => {
      const parsedData = JSON.parse(data.toString());
      if (parsedData.s) this.sequence_number = parsedData.s;
      if (parsedData.op) this.hearbeat_responded = true;
      if (!parsedData.t && this.session_id !== '' && this.connection_closed) {
        this.hearbeat_responded = true;
        this.heartbeat_interval = parsedData.d.heartbeat_interval;
        this.ws.send(
          JSON.stringify({
            op: 6,
            d: {
              token: this.token,
              session_id: this.session_id,
              seq: this.sequence_number
            }
          })
        );
        this.connection_closed = false;
      }
      if (!parsedData.t && !this.heartbeat_interval) {
        this.hearbeat_responded = true;
        this.heartbeat_interval = parsedData.d.heartbeat_interval;
        this.ws.send(
          JSON.stringify({
            op: 2,
            d: {
              token: this.token,
              properties: {
                $os: 'linux',
                $browse: 'disco',
                $device: 'disco'
              },
              intents: this.intents
            }
          })
        );
      }
      this.emit('DEBUG', parsedData, this.sequence_number);
      if (parsedData.t == 'READY') this.session_id = parsedData.d.session_id;
      if (parsedData.t) this.handleEvent(parsedData.t, parsedData.d);
    });
  }

  private handleEvent(event: string, object: unknown) {
    this.emit(event, object);
  }

  public setStatus(presence: GatewayPresenceUpdateData) {
    this.ws.send(
      JSON.stringify({
        op: 3,
        d: presence
      })
    );
  }

  /**
   * Create a DM channel with someone and return it
   */
  public createDM = async (user: string) => {
    const res = await fetch('https://discord.com/api/v9/users/@me/channels', {
      headers: {
        Authorization: 'Bot ' + this.token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        recipient_id: user
      }),
      method: 'POST'
    });
    const json: APIChannel = await res.json();
    return json;
  };

  /**
   * Send a message in a channel (only text)
   */
  public sendMessage = async (channel: string, content: string) => {
    const res = await fetch(
      `https://discord.com/api/v9/channels/${channel}/messages`,
      {
        headers: {
          Authorization: 'Bot ' + this.token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: content
        }),
        method: 'POST'
      }
    );
    const json: APIMessage = await res.json();
    return json;
  };

  /**
   * Reply to a message in a given channel (only text)
   */
  public replyToMessage = async (
    channel: string,
    message: string,
    content: string
  ) => {
    const res = await fetch(
      `https://discord.com/api/v9/channels/${channel}/messages`,
      {
        headers: {
          Authorization: 'Bot ' + this.token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: content,
          message_reference: {
            message_id: message
          }
        }),
        method: 'POST'
      }
    );
    const json: APIMessage = await res.json();
    return json;
  };
}

export { Client };
