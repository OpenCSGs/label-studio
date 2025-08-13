import TriggerOptions = Cypress.TriggerOptions;
import ObjectLike = Cypress.ObjectLike;
import ClickOptions = Cypress.ClickOptions;
import { LabelStudio } from "@humansignal/frontend-test/helpers/LSF/LabelStudio";
import { TWO_FRAMES_TIMEOUT } from "../../../../editor/tests/integration/e2e/utils/constants";

type MouseInteractionOptions = Partial<TriggerOptions & ObjectLike & MouseEvent>;

export const AudioView = {
  get root() {
    return cy.get(".lsf-audio-tag");
  },
  get errorContainer() {
    return this.root.find('[data-testid^="error:"]', { timeout: 30000 });
  },
  get drawingArea() {
    return this.root.find("canvas");
  },
  get visualizer() {
    return this.drawingArea.parent();
  },
  get container() {
    return this.visualizer.parent();
  },
  get timelineControls() {
    return this.root.find(".lsf-timeline-controls");
  },
  get currentTimebox() {
    return this.timelineControls.find('[data-testid="timebox-current-time"] > .lsf-time-box__input-time');
  },
  get endTimebox() {
    return this.timelineControls.find('[data-testid="timebox-end-time"] > .lsf-time-box__input-time');
  },
  get configButton() {
    return this.timelineControls.find(".lsf-audio-config > [aria-label='Audio settings']");
  },
  get volumeButton() {
    return this.timelineControls.find(".lsf-audio-control > .lsf-button");
  },
  get loadingBar() {
    return this.root.get("loading-progress-bar", { timeout: 10000 });
  },
  get audioElement() {
    return cy.get('[data-testid="waveform-audio"]');
  },
  get volumeSlider() {
    return this.root.find(".lsf-audio-slider__range");
  },
  get volumeInput() {
    return this.root.find(".lsf-audio-slider__input");
  },
  get muteButton() {
    return this.root.find(".lsf-audio-control__mute-button");
  },
  get playbackSpeedSlider() {
    return cy.get(
      ".lsf-audio-config__modal > .lsf-audio-config__scroll-content > .lsf-audio-slider:nth-child(2) .lsf-audio-slider__range",
    );
  },
  get playbackSpeedInput() {
    return cy.get(
      ".lsf-audio-config__modal > .lsf-audio-config__scroll-content > .lsf-audio-slider:nth-child(2) .lsf-audio-slider__input",
    );
  },
  get amplitudeSlider() {
    return cy.get(
      ".lsf-audio-config__modal > .lsf-audio-config__scroll-content > .lsf-audio-slider:nth-child(3) .lsf-audio-slider__range",
    );
  },
  get amplitudeInput() {
    return cy.get(
      ".lsf-audio-config__modal > .lsf-audio-config__scroll-content > .lsf-audio-slider:nth-child(3) .lsf-audio-slider__input",
    );
  },
  get hideTimelineButton() {
    return cy.get(".lsf-audio-config__buttons > .lsf-audio-config__menu-button:nth-child(1)");
  },
  get hideWaveformButton() {
    return cy.get(".lsf-audio-config__buttons > .lsf-audio-config__menu-button:nth-child(2)");
  },
  isReady() {
    LabelStudio.waitForObjectsReady();
    this.loadingBar.should("not.exist");
    /**
     * There is a time gap between setting `isReady` to `true` and getting the last initial draw at the canvas,
     * which for now we are going to compensate by waiting approximately 2 frames of render (16 * 2 = 32 milliseconds)
     * @todo: remove wait when `isReady` in audio become more precise
     */
    cy.wait(TWO_FRAMES_TIMEOUT);
  },
  get playButton() {
    return cy.get(`.lsf-audio-tag [data-testid="playback-button:play"]`);
  },
  get pauseButton() {
    return cy.get(`.lsf-audio-tag [data-testid="playback-button:pause"]`);
  },
  seekCurrentTimebox(to: number) {
    let timeString = "";
    timeString = `${to.toString().padStart(6, "0")}000`;

    this.currentTimebox.click({ force: true }).clear().type(timeString, { force: true }).blur();
  },
  pause() {
    this.pauseButton.click();
  },
  play(from?: number, to?: number) {
    if (from) {
      this.seekCurrentTimebox(from);
    }
    this.playButton.click();
    if (to) {
      cy.wait((to - (from || 0)) * 1000);
      this.pause();
    }
  },
  toggleControlsMenu() {
    this.volumeButton.click();
    cy.wait(100);
  },
  toggleSettingsMenu() {
    this.configButton.click();
    cy.wait(100);
  },
  setVolumeInput(value: number) {
    this.toggleControlsMenu();
    this.volumeInput.clear().type(value.toString());
    this.volumeInput.should("have.value", value.toString());
    this.toggleControlsMenu();
  },
  setPlaybackSpeedInput(value: number) {
    this.toggleSettingsMenu();
    this.playbackSpeedInput.dblclick().clear().type(value.toString());
    this.playbackSpeedInput.should("have.value", value.toString());
    this.toggleSettingsMenu();
  },
  setAmplitudeInput(value: number) {
    this.toggleSettingsMenu();
    this.amplitudeInput.clear().type(value.toString());
    this.amplitudeInput.should("have.value", value.toString());
    this.toggleSettingsMenu();
  },
  clickMuteButton() {
    this.toggleControlsMenu();
    this.muteButton.click();
    this.toggleControlsMenu();
  },
  /**
   * Clicks at the coordinates on the drawing area
   * @param {number} x
   * @param {number} y
   */
  clickAt(x: number, y: number, options?: Partial<ClickOptions>) {
    cy.log(`Click at the AudioView at (${x}, ${y})`);
    this.drawingArea.scrollIntoView().click(x, y, options);
  },
  /**
   * Clicks at the relative coordinates on the drawing area
   * @param {number} x
   * @param {number} y
   */
  clickAtRelative(x: number, y: number, options?: Partial<ClickOptions>) {
    this.drawingArea.then((el) => {
      const bbox: DOMRect = el[0].getBoundingClientRect();
      const realX = x * bbox.width;
      const realY = y * bbox.height;

      this.clickAt(realX, realY, options);
    });
  },

  hoverAt(x: number, y: number, options: MouseInteractionOptions = {}) {
    cy.log(`Hover at the AudioView at (${x}, ${y})`);
    this.drawingArea.scrollIntoView().trigger("mousemove", x, y, options);
  },

  hoverAtRelative(x: number, y: number, options: MouseInteractionOptions = {}) {
    this.drawingArea.then((el) => {
      const bbox: DOMRect = el[0].getBoundingClientRect();
      const realX = x * bbox.width;
      const realY = y * bbox.height;

      this.hoverAt(realX, realY, options);
    });
  },
  /**
   * Draws a rectangle on the drawing area.
   * It also could be used for some drag and drop interactions for example selecting area or moving existing regions.
   * @param {number} x
   * @param {number} y
   * @param {number} width
   * @param {number} height
   */
  drawRect(x: number, y: number, width: number, height: number, options: MouseInteractionOptions = {}) {
    cy.log(`Draw rectangle at (${x}, ${y}) of size ${width}x${height}`);
    this.drawingArea
      .scrollIntoView()
      .trigger("mousemove", x, y, {
        eventConstructor: "MouseEvent",
        buttons: 1,
        ...options,
      })
      .trigger("mousedown", x, y, {
        eventConstructor: "MouseEvent",
        buttons: 1,
        ...options,
      })
      .trigger("mousemove", x + width, y + height, {
        eventConstructor: "MouseEvent",
        buttons: 1,
        ...options,
      })
      .trigger("mouseup", x + width, y + height, {
        eventConstructor: "MouseEvent",
        buttons: 1,
        ...options,
      })
      .wait(0);
  },
  /**
   * Draws the rectangle on the drawing area with coordinates and size relative to the drawing area.
   * It also could be used for some drag and drop interactions for example selecting area or moving existing regions.
   * @param {number} x
   * @param {number} y
   * @param {number} width
   * @param {number} height
   */
  drawRectRelative(x: number, y: number, width: number, height: number, options: MouseInteractionOptions = {}) {
    this.drawingArea.then((el) => {
      const bbox: DOMRect = el[0].getBoundingClientRect();
      const realX = x * bbox.width;
      const realY = y * bbox.height;
      const realWidth = width * bbox.width;
      const realHeight = height * bbox.height;

      this.drawRect(realX, realY, realWidth, realHeight, options);
    });
  },

  /**
   * Matches the visual appearance of the entire AudioView component
   */
  toMatchImageSnapshot(el?: Cypress.Chainable<JQuery<HTMLElement>>, options?: { name?: string; threshold?: number }) {
    el = el || this.root;
    let name;
    if (options && options.name) {
      name = options.name;
      delete options.name;
    }
    if (name) {
      el.wait(0).matchImageSnapshot(name);
    } else {
      el.wait(0).matchImageSnapshot();
    }
  },

  getPixelColor(x: number, y: number) {
    this.drawingArea.trigger("getPixelColor", x, y);
    return this.drawingArea.then(async (canvas) => {
      const ctx = canvas[0].getContext("2d");
      const pixelRatio = window.devicePixelRatio;
      const pixel = ctx.getImageData(Math.round(x) * pixelRatio, Math.round(y) * pixelRatio, 1, 1);

      const displayColor = `rbga(${pixel.data[0]}, ${pixel.data[1]}, ${pixel.data[2]}, ${pixel.data[3]})`;
      cy.log(
        `Color: #${pixel.data[0].toString(16)}${pixel.data[1].toString(16)}${pixel.data[2].toString(16)}${
          pixel.data[3] !== 255 ? pixel.data[3].toString(16) : ""
        } or ${displayColor}`,
      );
      return await pixel.data;
    });
  },

  getPixelColorRelative(x: number, y: number) {
    return this.drawingArea.then((el) => {
      const bbox: DOMRect = el[0].getBoundingClientRect();
      const realX = x * bbox.width;
      const realY = y * bbox.height;

      return this.getPixelColor(realX, realY);
    });
  },

  zoomIn({ times = 1, speed = 4 }) {
    cy.log(`Zoom in by ${times} times)`);
    for (let i = 0; i < times; i++) {
      this.visualizer.trigger("wheel", "center", "center", {
        deltaY: -speed,
        ctrlKey: true,
        metaKey: true,
      });
    }
  },

  scroll({ times = 1, speed = 4, backward = false }) {
    cy.log(`Scroll by ${times} times)`);
    for (let i = 0; i < times; i++) {
      this.visualizer.trigger("wheel", "center", "center", {
        deltaX: 0,
        deltaY: backward ? -speed : speed,
      });
    }
  },

  /**
   * Checks if an error message is displayed in the audio view
   * @param {string} errorText - The error text to check for
   */
  hasError(errorText: string) {
    cy.log(`Checking for error message: "${errorText}"`);
    this.errorContainer.should("exist");
    this.errorContainer.contains(errorText).should("exist");
  },
};
