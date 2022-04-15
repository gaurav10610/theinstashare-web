import { Injectable } from "@angular/core";
import { MessageContextSpec } from "../../contracts/context/MessageContextSpec";
import { MessageContext } from "../../contracts/context/MessageContext";
import { UserContextService } from "../user.context.service";
import { FileTransferContextSpec } from "../../contracts/context/FileTransferContextSpec";
import { TransferredFileContext } from "../../contracts/file/TransferredFileContext";
import { QueueStorage } from "../../util/QueueStorage";

@Injectable({
  providedIn: "root",
})
export class FileTransferContextService
  implements MessageContextSpec, FileTransferContextSpec
{
  /**
   *
   * stores text messages context in following manner
   *
   * 'username' -> [{ ..message context props }, { ..message context props }]
   *
   */
  messageContext: Map<string, MessageContext[]>;

  /**
   *
   * stores transferred files context in following manner
   *
   * 'username' -> [{ ..received file context props }, { ..sent file context props }]
   *
   */
  fileContext: Map<string, TransferredFileContext[]>;

  /**
   * stores file queues(for uploaded files) in following manner
   *
   * 'username' -> [{ ..sent file context props }, { ..sent file context props }]
   */
  fileQueues: Map<string, QueueStorage<File>>;

  /**
   * this contains list of all online users and their status mappings
   *
   * 'username1' -> true //online
   * 'username2' -> false //offline
   *
   */
  userStatus: Map<string, boolean>;

  //list of active usernames
  activeUsers: string[];

  bindingFlags: Map<string, boolean>;

  constructor(private userContextService: UserContextService) {
    this.messageContext = new Map();
    this.fileContext = new Map();
    this.fileQueues = new Map();
    this.userStatus = new Map();
    this.activeUsers = [];

    // setting binding flags
    this.bindingFlags = new Map();
    this.bindingFlags.set("showSidePanel", true);
    this.bindingFlags.set("showMessagePanel", true);
  }

  hasFileQueue(username: string): boolean {
    return this.fileQueues.has(username);
  }

  initializeFileQueue(username: string): void {
    if (!this.hasFileQueue(username)) {
      this.fileQueues.set(username, new QueueStorage<File>());
    }
  }

  getFileQueue(username: string): QueueStorage<File> {
    return this.fileQueues.get(username);
  }

  hasFileContext(username: string): boolean {
    return this.fileContext.has(username);
  }

  initializeFileContext(username: string): void {
    if (!this.hasFileContext(username)) {
      this.fileContext.set(username, []);
    }
  }

  getFileContext(username: string): TransferredFileContext[] {
    return this.fileContext.get(username);
  }

  hasMessageContext(username: string): boolean {
    return this.messageContext.has(username);
  }

  initializeMessageContext(username: string): void {
    if (!this.hasMessageContext(username)) {
      this.messageContext.set(username, []);
    }
  }

  getMessageContext(username: string): MessageContext[] {
    return this.messageContext.get(username);
  }

  getUserStatus(username: string): boolean {
    return this.userStatus.get(username);
  }

  getBindingFlags(propertyName: string): boolean {
    return this.bindingFlags.get(propertyName);
  }
}
