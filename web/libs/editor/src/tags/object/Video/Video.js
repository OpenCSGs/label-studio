import { getRoot, types } from "mobx-state-tree";
import React from "react";

import { AnnotationMixin } from "../../../mixins/AnnotationMixin";
import IsReadyMixin from "../../../mixins/IsReadyMixin";
import ProcessAttrsMixin from "../../../mixins/ProcessAttrs";
import { SyncableMixin } from "../../../mixins/Syncable";
import { parseValue } from "../../../utils/data";
import { FF_VIDEO_FRAME_SEEK_PRECISION, isFF } from "../../../utils/feature-flags";
import ObjectBase from "../Base";
import { isDefined } from "../../../utils/utilities";

/**
 * Video tag plays a simple video file. Use for video annotation tasks such as classification and transcription.
 *
 * Use with the following data types: video
 *
 * ### Video format
 *
 * Label Studio relies on your web browser to play videos and evaluate the total frame number. So, it's essential that your videos use a format and codecs that are universally supported. To ensure maximum compatibility, we recommend using an MP4 container with video encoded using the H.264 (AVC) codec and audio encoded with AAC. This combination is widely supported across all modern browsers and minimizes issues like incorrect total duration detection or problems with playback. In addition, it's important to convert your videos to a constant frame rate (CFR), ideally around 30 fps, to avoid discrepancies in frame counts and issues with duplicated or missing frames. All audio and video streams from your file must have the same durations; otherwise, you will have extra total frames.
 *
 * Converting your videos to this recommended format will help ensure that they play smoothly in Label Studio and that the frame rate and duration are correctly recognized for accurate annotations. To convert any video to this format, you can use FFmpeg. For example, the following commands convert an input video to MP4 with H.264 video, AAC audio, and a constant frame rate of 30 fps:
 *
 * ```bash
 * # Extract the exact video stream duration in seconds
 * DUR=$(ffprobe -v error -select_streams v:0 -show_entries stream=duration -of default=nokey=1:noprint_wrappers=1 input.mp4)
 * # Re-encode media file to recommended format
 * ffmpeg -i input_video.mp4 -c:v libx264 -profile:v high -level 4.0 -pix_fmt yuv420p -r 30 -c:a aac -b:a 128k -to $DUR output_video.mp4
 * ```
 *
 * In this command:
 * - `-i input_video.mp4` specifies your source video.
 * - `-c:v libx264` uses the H.264 codec for video encoding.
 * - `-profile:v high -level 4.0` sets compatibility parameters for a broad range of devices.
 * - `-pix_fmt yuv420p` ensures the pixel format is compatible with most browsers.
 * - `-r 30` forces a constant frame rate of 30 fps. You can also omit the -r option, ffmpeg will save your current frame rate. This is fine if you are 100% certain that your video has a constant frame rate.
 * - `-c:a aac -b:a 128k` encodes the audio in AAC at 128 kbps.
 * - `-to` stops writing output as soon as the container clock hits your video’s end timestamp, so any extra audio tail is automatically dropped.
 * - `output_video.mp4` is the converted video file ready for use in Label Studio.
 *
 * Using this FFmpeg command to re-encode your videos will help eliminate playback issues and ensure that Label Studio detects the total video duration  accurately, providing a smooth annotation experience.
 *
 * It is a good idea to check all parameters of your video using this command:
 * ```bash
 * ffprobe -v error -show_format -show_streams -print_format json input.mp4
 * ```
 *
 * @example
 * <!--Labeling configuration to display a video on the labeling interface-->
 * <View>
 *   <Video name="video" value="$video" />
 * </View>
 * @example
 * <!-- Video classification -->
 * <View>
 *   <Video name="video" value="$video" />
 *   <Choices name="ch" toName="video">
 *     <Choice value="Positive" />
 *     <Choice value="Negative" />
 *   </Choices>
 * </View>
 * @example
 * <!-- Video transcription -->
 * <View>
 *   <Video name="video" value="$video" />
 *   <TextArea name="ta" toName="video" />
 * </View>
 * @name Video
 * @meta_title Video Tag for Video Labeling
 * @meta_description Customize Label Studio with the Video tag for basic video annotation tasks for machine learning and data science projects.
 * @param {string} name Name of the element
 * @param {string} value URL of the video
 * @param {number} [frameRate=24] video frame rate per second; default is 24; can use task data like `$fps`
 * @param {string} [sync] object name to sync with
 * @param {boolean} [muted=false] muted video
 * @param {number} [height=600] height of the video player
 * @param {number} [timelineHeight=64] height of the timeline with regions
 */

const TagAttrs = types.model({
  value: types.maybeNull(types.string),
  hotkey: types.maybeNull(types.string),
  framerate: types.optional(types.string, "24"),
  height: types.optional(types.string, "600"),
  timelineheight: types.maybeNull(types.string),
  muted: false,
});

const Model = types
  .model({
    type: "video",
    _value: types.optional(types.string, ""),
    // special flag to store labels inside result, but under original type
    // @todo make it able to be disabled
    mergeLabelsAndResults: true,
  })
  .volatile(() => ({
    errors: [],
    speed: 1,
    ref: React.createRef(),
    frame: 1,
    length: 1,
    drawingRegion: null,
  }))
  .views((self) => ({
    get store() {
      return getRoot(self);
    },

    get currentFrame() {
      return self.ref.current?.position ?? 1;
    },

    get timelineControl() {
      return self.annotation.toNames.get(self.name)?.find((s) => s.type.includes("timeline"));
    },

    get videoControl() {
      return self.annotation.toNames.get(self.name)?.find((s) => s.type.includes("video"));
    },

    states() {
      return self.annotation.toNames.get(self.name)?.filter((s) => s.type.endsWith("labels"));
    },

    activeStates() {
      const states = self.states();

      return states ? states.filter((c) => c.isSelected === true) : null;
    },

    get hasStates() {
      const states = self.states();

      return states && states.length > 0;
    },
  }))
  .actions((self) => ({
    afterCreate() {
      // normalize framerate — should be string with number of frames per second
      const framerate = Number(parseValue(self.framerate, self.store.task?.dataObj));

      if (!framerate || Number.isNaN(framerate)) self.framerate = "24";
      else if (framerate < 1) self.framerate = String(1 / framerate);
      else self.framerate = String(framerate);
    },
  }))
  ////// Sync actions
  .actions((self) => ({
    ////// Outgoing

    /**
     * Wrapper to always send important data
     * @param {string} event
     * @param {any} data
     */
    triggerSync(event, data) {
      if (!self.ref.current) return;

      self.syncSend(
        {
          playing: self.ref.current.playing,
          time: self.ref.current.frameSteppedTime(),
          ...data,
        },
        event,
      );
    },

    triggerSyncPlay() {
      self.triggerSync("play", { playing: true });
    },

    triggerSyncPause() {
      self.triggerSync("pause", { playing: false });
    },

    ////// Incoming

    registerSyncHandlers() {
      for (const event of ["play", "pause", "seek"]) {
        self.syncHandlers.set(event, self.handleSync);
      }
      self.syncHandlers.set("speed", self.handleSyncSpeed);
    },

    handleSync(data) {
      if (!self.ref.current) return;

      const video = self.ref.current;

      if (data.playing) {
        if (!video.playing) video.play();
      } else {
        if (video.playing) video.pause();
      }

      if (data.speed) {
        self.speed = data.speed;
      }

      video.currentTime = data.time;
    },

    handleSyncSpeed(data) {
      if (isDefined(data.speed)) {
        self.speed = data.speed;
      }
    },

    handleSeek() {
      self.triggerSync("seek");
    },

    syncMuted(muted) {
      self.muted = muted;
    },
  }))
  .actions((self) => {
    return {
      setLength(length) {
        self.length = length;
      },

      setOnlyFrame(frame) {
        if (self.frame !== frame) {
          self.frame = frame;
        }
      },

      setFrame(frame) {
        if (self.frame !== frame && self.framerate) {
          self.frame = frame;
          if (isFF(FF_VIDEO_FRAME_SEEK_PRECISION)) {
            self.ref.current.goToFrame(frame);
          } else {
            self.ref.current.currentTime = frame / self.framerate;
          }
        }
      },

      addVideoRegion(data) {
        const control = self.videoControl;
        const value = {};

        if (!control) {
          console.error("No video control is found");
          return;
        }

        const sequence = [
          {
            frame: self.frame,
            enabled: true,
            rotation: 0,
            ...data,
          },
        ];

        const area = self.annotation.createResult({ sequence }, {}, control, self);

        // add labels
        for (const tag of self.activeStates()) {
          area.setValue(tag);
        }

        return area;
      },

      addTimelineRegion(data) {
        const control = self.timelineControl;

        if (!control) {
          console.error("No video timeline control is found");
          return;
        }

        const frame = data.frame ?? self.frame;
        const value = {
          ranges: [{ start: frame, end: frame }],
        };
        // @todo only one attached labeling tag is supported right now :(
        const labels = self.activeStates()?.[0];
        const labeling = {
          [labels.valueType]: labels.selectedValues(),
        };

        return self.annotation.createResult(value, labeling, control, self);
      },

      deleteRegion(id) {
        self.findRegion(id)?.deleteRegion();
      },

      findRegion(id) {
        return self.regs.find((reg) => reg.cleanId === id);
      },

      /**
       * Create a new timeline region at a given `frame` (only if labels are selected) or edit an existing one if `region` is provided
       * @param {Object} options
       * @param {number} options.frame current frame under the cursor
       * @param {string} options.region region id to search for it in the store; used to edit existing region
       * @returns {Object} created region
       */
      startDrawing({ frame, region: id }) {
        // don't create or edit regions in read-only mode
        if (self.annotation.isReadOnly()) return null;

        if (id) {
          const region = self.annotation.regions.find((r) => r.cleanId === id);
          const range = region?.ranges?.[0];
          return range && [range.start, range.end].includes(frame) ? region : null;
        }
        const control = self.timelineControl;
        // labels should be selected or allow to create region without labels
        if (!control?.selectedLabels?.length && !control?.allowempty) return null;

        self.drawingRegion = self.addTimelineRegion({ frame, enabled: false });

        return self.drawingRegion;
      },

      /**
       * Finish drawing a region and save its final state to the store if it was edited
       * @param {Object} options
       * @param {string} options.mode "new" if we are creating a new region, "edit" if we are editing an existing one
       */
      finishDrawing({ mode }) {
        self.drawingRegion = null;
        if (mode === "edit") {
          self.annotation.history.recordNow();
        }
      },
    };
  });

export const VideoModel = types.compose(
  "VideoModel",
  SyncableMixin,
  TagAttrs,
  ProcessAttrsMixin,
  ObjectBase,
  AnnotationMixin,
  Model,
  IsReadyMixin,
);
