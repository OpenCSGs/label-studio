import { AudioView, Labels, LabelStudio, Relations } from "@humansignal/frontend-test/helpers/LSF";
import { audioOneRegionResult, audioWithLabelsConfig, audioWithLabelsData } from "../../data/audio/audio_regions";
import { TWO_FRAMES_TIMEOUT } from "../utils/constants";

// This test suite has exhibited flakiness in the past, so we are going to run it with retries
// while we investigate the root cause.
const suiteConfig = {
  retries: {
    runMode: 3,
    openMode: 0,
  },
};

describe("Audio regions", suiteConfig, () => {
  it("Should have indication of selected state", () => {
    LabelStudio.params()
      .config(audioWithLabelsConfig)
      .data(audioWithLabelsData)
      .withResult(audioOneRegionResult)
      .init();

    LabelStudio.waitForObjectsReady();
    AudioView.isReady();

    const baseRegionColor = AudioView.getPixelColorRelative(0.36, 0.9);

    AudioView.clickAtRelative(0.38, 0.5);
    const selectedRegionColor = AudioView.getPixelColorRelative(0.36, 0.9);

    selectedRegionColor.then((color) => {
      baseRegionColor.should("not.deep.equal", color);
    });
    // unselecting
    cy.get("body").type("{esc}");
    const unselectedRegionColor = AudioView.getPixelColorRelative(0.36, 0.9);
    unselectedRegionColor.then((color) => {
      baseRegionColor.should("deep.equal", color);
    });
  });

  it("Should have indication of active state", () => {
    LabelStudio.params()
      .config(audioWithLabelsConfig)
      .data(audioWithLabelsData)
      .withResult(audioOneRegionResult)
      .init();

    LabelStudio.waitForObjectsReady();
    AudioView.isReady();

    // Wait for audio visualization to stabilize before capturing baseline
    cy.wait(TWO_FRAMES_TIMEOUT);
    const baseRegionColor = AudioView.getPixelColorRelative(0.36, 0.9);

    // moving the cursor
    AudioView.seekCurrentTimebox(38);
    // Allow time for active state rendering to complete
    cy.wait(TWO_FRAMES_TIMEOUT);
    const activeRegionColor = AudioView.getPixelColorRelative(0.36, 0.9);

    activeRegionColor.then((color) => {
      baseRegionColor.should("not.deep.equal", color);
    });

    // deactivating
    AudioView.seekCurrentTimebox(0);
    // Wait for inactive state to be fully rendered
    cy.wait(TWO_FRAMES_TIMEOUT);
    const inactiveRegionColor = AudioView.getPixelColorRelative(0.36, 0.9);

    inactiveRegionColor.then((color) => {
      baseRegionColor.should("deep.equal", color);
    });
  });

  it("Should have indication of highlighted state", () => {
    LabelStudio.params()
      .config(audioWithLabelsConfig)
      .data(audioWithLabelsData)
      .withResult(audioOneRegionResult)
      .init();

    LabelStudio.waitForObjectsReady();
    AudioView.isReady();

    const baseRegionColor = AudioView.getPixelColorRelative(0.36, 0.9);

    // highlighting in relations mode
    Labels.select("Music");
    AudioView.drawRectRelative(0.1, 0.5, 0.1, 0, { force: true });
    AudioView.clickAtRelative(0.15, 0.5);
    Relations.toggleCreation();

    AudioView.hoverAtRelative(0.4, 0.5);

    const highlightedRegionColor = AudioView.getPixelColorRelative(0.36, 0.9);

    highlightedRegionColor.then((color) => {
      baseRegionColor.should("not.deep.equal", color);
    });

    // unhighlighting
    AudioView.container.trigger("mouseleave");

    const unhighlightedRegionColor = AudioView.getPixelColorRelative(0.36, 0.9);

    unhighlightedRegionColor.then((color) => {
      baseRegionColor.should("deep.equal", color);
    });
  });

  it("Should avoid intersection of active and highlighted states", () => {
    LabelStudio.params()
      .config(audioWithLabelsConfig)
      .data(audioWithLabelsData)
      .withResult(audioOneRegionResult)
      .init();

    LabelStudio.waitForObjectsReady();
    AudioView.isReady();

    const baseRegionColor = AudioView.getPixelColorRelative(0.36, 0.9);

    // highlighting in relations mode
    Labels.select("Music");
    AudioView.drawRectRelative(0.1, 0.5, 0.1, 0, { force: true });
    AudioView.clickAtRelative(0.15, 0.5);
    Relations.toggleCreation();

    AudioView.hoverAtRelative(0.4, 0.5);

    const highlightedRegionColor = AudioView.getPixelColorRelative(0.36, 0.9);

    highlightedRegionColor.then((color) => {
      baseRegionColor.should("not.deep.equal", color);
    });

    // moving the cursor
    AudioView.seekCurrentTimebox(38);
    const activeRegionColor = AudioView.getPixelColorRelative(0.36, 0.9);

    activeRegionColor.then((color) => {
      baseRegionColor.should("not.deep.equal", color);
      highlightedRegionColor.should("deep.equal", color);
    });

    // deactivating
    AudioView.seekCurrentTimebox(0);
    const inactiveRegionColor = AudioView.getPixelColorRelative(0.36, 0.9);

    // should still be highlighted
    inactiveRegionColor.then((color) => {
      baseRegionColor.should("not.deep.equal", color);
      highlightedRegionColor.should("deep.equal", color);
    });

    // unhighlighting
    AudioView.container.trigger("mouseleave");

    const unhighlightedRegionColor = AudioView.getPixelColorRelative(0.36, 0.9);

    unhighlightedRegionColor.then((color) => {
      baseRegionColor.should("deep.equal", color);
    });
  });
});
