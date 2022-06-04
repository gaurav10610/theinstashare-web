import { Injectable } from "@angular/core";
import { MessageContextSpec } from "../../contracts/context/MessageContextSpec";
import { MessageContext } from "../../contracts/context/MessageContext";
import { UserContextService } from "../user.context.service";
import { FileTransferContextSpec } from "../../contracts/context/FileTransferContextSpec";
import { TransferredFileContext } from "../../contracts/file/file-transfer";
import { BaseContextServiceSpec } from "../../contracts/context/context";

@Injectable({
  providedIn: "root",
})
export class FileTransferContextService
  implements
    MessageContextSpec,
    FileTransferContextSpec,
    BaseContextServiceSpec
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
   * 'username' -> {'123' -> { ..received file context props }, '321' -> { ..sent file context props }}
   *
   */
  fileContext: Map<string, Map<string, TransferredFileContext>>;

  /**
   * this will keep track of the file which is currently being sent
   */
  currentSentFile: TransferredFileContext;

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

  /**
   * this will keep the unread count for chat & files to show it on badges on buttons
   *
   * 'username' -> { chat: 3, file: 4}
   */
  unreadBadgeConfig: Map<string, any>;

  constructor() {
    this.messageContext = new Map();
    this.fileContext = new Map();
    this.userStatus = new Map();
    this.activeUsers = [];
    this.unreadBadgeConfig = new Map();

    // setting binding flags
    this.bindingFlags = new Map();
    this.bindingFlags.set("showSidePanel", true);
    this.bindingFlags.set("showMessagePanel", true);
  }

  cleanup(): Promise<boolean> {
    throw new Error("Method not implemented.");
  }

  hasBadgeConfig(username: string): boolean {
    return this.unreadBadgeConfig.has(username);
  }

  initializeBadgeConfig(username: string): void {
    if (!this.hasBadgeConfig(username)) {
      this.unreadBadgeConfig.set(username, {
        chat: 0,
        file: 0,
      });
    }
  }

  getBadgeConfig(username: string): any {
    return this.unreadBadgeConfig.get(username);
  }

  hasFileContext(username: string): boolean {
    return this.fileContext.has(username);
  }

  initializeFileContext(username: string): void {
    if (!this.hasFileContext(username)) {
      this.fileContext.set(username, new Map());
    }
  }

  getFileContext(username: string): Map<string, TransferredFileContext> {
    return this.fileContext.get(username);
  }

  getSharedFiles(
    username: string,
    needSentFiles: boolean
  ): TransferredFileContext[] {
    if (this.fileContext.has(username)) {
      return Array.from(this.fileContext.get(username)?.values()).filter(
        (file) => file.isSent === needSentFiles
      );
    }
    return [];
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
