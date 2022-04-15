import { Injectable } from "@angular/core";
import { MessageContextSpec } from "../../contracts/context/MessageContextSpec";
import { MessageContext } from "../../contracts/context/MessageContext";
import { UserContextService } from "../user.context.service";
import { FileTransferContextSpec } from "../../contracts/context/FileTransferContextSpec";
import { TransferredFileContext } from "../../contracts/file/TransferredFileContext";

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
    this.userStatus = new Map();
    this.activeUsers = [];

    // setting binding flags
    this.bindingFlags = new Map();
    this.bindingFlags.set("showSidePanel", true);
    this.bindingFlags.set("showMessagePanel", true);
  }

  hasFileContext(username: string): boolean {
    throw new Error("Method not implemented.");
  }

  initializeFileContext(username: string): void {
    throw new Error("Method not implemented.");
  }

  getFileContext(username: string): TransferredFileContext[] {
    throw new Error("Method not implemented.");
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
