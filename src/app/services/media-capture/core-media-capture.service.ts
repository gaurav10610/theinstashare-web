import { Injectable } from '@angular/core';
import { AppConstants } from '../AppConstants';
import { UserContextService } from '../context/user.context.service';
import { LoggerUtil } from '../logging/LoggerUtil';

@Injectable({
  providedIn: 'root'
})
export class CoreMediaCaptureService {

  constructor(
    private userContextService: UserContextService
  ) { }

  /**
   * capture appropriate media stream for supplied media type
   *
   * @param mediaChannel media type i.e 'audio', 'video' etc.
   * 
   * @param constraints optional media constraints 
   *
   * @return captured media stream
   */
  getMediaStream(mediaChannel: string, constraints?: any) {
    return new Promise(async (resolve, reject) => {
      try {
        let stream: any;
        let mediaDevices: any = navigator.mediaDevices;
        let mediaContraints: any;
        if (constraints) {
          mediaContraints = constraints;
        } else {
          mediaContraints = await this.getMediaConstraints(mediaChannel);
        }
        if (mediaChannel === AppConstants.SCREEN && !this.userContextService.isNativeApp) {
          stream = await mediaDevices.getDisplayMedia(mediaContraints);
          this.userContextService.screenStream = stream;
        } else if (mediaChannel === AppConstants.SOUND && !this.userContextService.isNativeApp) {
          stream = this.userContextService.screenStream;
        } else {
          stream = await mediaDevices.getUserMedia(mediaContraints);
        }
        resolve(stream);
      } catch (e) {
        // this.appUtilService.flagError('error: unable to access ' + mediaChannel + ' device');
        reject(e);
      }
    });
  }

  /**
   * retreive appropriate media constraints for get user media api to capture media
   * stream based on supplied media channel
   *
   * @param mediaChannel media type i.e 'audio', 'video' etc.
   */
  private getMediaConstraints(channel: string) {
    return new Promise((resolve) => {
      let constraints: any;
      if (channel === AppConstants.AUDIO) {
        constraints = AppConstants.AUDIO_CONSTRAINTS;
      } else if (channel === AppConstants.VIDEO && this.userContextService.isMobile) {
        constraints = AppConstants.MOBILE_CONSTRAINTS;
        constraints.video.facingMode = this.userContextService.defaultCamera;
      } else if (channel === AppConstants.VIDEO && !this.userContextService.isMobile) {
        constraints = AppConstants.VIDEO_CONSTRAINTS;
      } else if (channel === AppConstants.SCREEN) {
        if (this.userContextService.isNativeApp) {
          constraints = AppConstants.SCREEN_SHARING_CONSTRAINTS;
        } else {
          constraints = AppConstants.WEB_SCREEN_SHARING_CONSTRAINTS;
        }
      } else if (channel === AppConstants.SOUND) {
        constraints = AppConstants.SYSTEM_SOUND_CONSTRAINTS;
      }
      resolve(constraints);
    });
  }

  /**
   * 
   * this will prompt the user to grant camera and microphone permissions
   */
  takeCameraAndMicrophoneAccess() {
    return new Promise<string>(async (resolve, reject) => {
      LoggerUtil.logAny('asking for camera and microphone permission');
      if (!this.userContextService.isCameraAccessible || !this.userContextService.isMicrophoneAccessible) {
        try {
          const stream: any = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
          stream.getAudioTracks().forEach(track => track.stop());
          stream.getVideoTracks().forEach(track => track.stop());
          this.userContextService.isCameraAccessible = true;
          this.userContextService.isMicrophoneAccessible = true;
          resolve('success');
        } catch (error) {
          LoggerUtil.logAny(error);
          reject('please check camera/microphone permissions');
        }
      } else {
        resolve('success');
      }
    });
  }
}
