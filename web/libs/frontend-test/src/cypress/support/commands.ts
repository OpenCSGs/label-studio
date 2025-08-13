import Loggable = Cypress.Loggable;
import Timeoutable = Cypress.Timeoutable;
import Thresholdable = Cypress.Thresholdable;
import CompareScreenshotOptions = Cypress.CompareScreenshotOptions;
import { addMatchImageSnapshotCommand } from "cypress-image-snapshot/command";

addMatchImageSnapshotCommand({
  failureThreshold: 0.1,
  failureThresholdType: "percent",
});

const Screenshots = new Map<string, string>();

// Clear Screenshots Map before each test to prevent conflicts between tests
beforeEach(() => {
  Screenshots.clear();
});

const getName = (suffix: string) => {
  const spec = Cypress.spec.name;

  return `${spec.replace(/.([jt]s)/, "")}-${suffix}`.toLowerCase();
};

Cypress.Commands.add(
  "captureScreenshot",
  {
    prevSubject: ["element"],
  },
  (subject, name, screenshotCaptureOptions: Partial<Loggable & Timeoutable & CompareScreenshotOptions> = {}) => {
    const { withHidden = [], ...screenshotOptions } = screenshotCaptureOptions;
    const log = Cypress.log({
      $el: subject,
      name: "captureScreenshot",
      displayName: "captureScreenshot",
      type: "parent",
      autoEnd: false,
    });

    const screenshotName = getName(name);

    if (Screenshots.has(screenshotName)) {
      throw new Error("Screenshot already taken. Did you forget to call `compareScreenshot`?");
    }

    const obj = cy.wrap(subject, { log: false });

    obj.scrollIntoView({ log: false });

    for (const hiddenSelector of withHidden) {
      cy.get(hiddenSelector).invoke("css", "visibility", "hidden");
    }

    // Add a small delay before taking capture screenshot
    cy.wait(100);

    obj.screenshot(
      `${screenshotName}-orig`,
      Object.assign({ log: false }, screenshotOptions, {
        onAfterScreenshot(_el, screenshot) {
          screenshotOptions.onAfterScreenshot?.(_el, screenshot);
          Screenshots.set(screenshotName, screenshot.path);
        },
      }),
    );
    for (const hiddenSelector of withHidden) {
      cy.get(hiddenSelector).invoke("css", "visibility", "");
    }
    log.end();
    return obj;
  },
);

Cypress.Commands.add(
  "compareScreenshot",
  {
    prevSubject: ["element"],
  },
  (
    subject,
    name,
    compare,
    screenshotCompareOptions: Partial<Loggable & Timeoutable & CompareScreenshotOptions & Thresholdable> = {},
  ) => {
    const { threshold = 0.1, withHidden = [], ...screenshotOptions } = screenshotCompareOptions;
    const screenshotName = getName(name);
    const log = Cypress.log({
      $el: subject,
      name: "compareScreenshot",
      message: "Comparing screenshots",
      autoEnd: false,
    });

    if (!Screenshots.has(screenshotName)) {
      throw new Error("Screenshot not found. Did you forget to capture it?");
    }

    const obj = cy.wrap(subject.get(0), { log: false });
    const options = {
      initialScreenshot: "",
      currentScreenshot: "",
      threshold,
      compare,
    };

    obj.scrollIntoView({ log: false });
    for (const hiddenSelector of withHidden) {
      cy.get(hiddenSelector).invoke("css", "visibility", "hidden");
    }

    // Add a small delay before taking comparison screenshot
    cy.wait(100);

    obj.screenshot(
      `${screenshotName}-comp`,
      Object.assign({ log: false }, screenshotOptions, {
        onAfterScreenshot(_el, currentScreenshot) {
          screenshotOptions.onAfterScreenshot?.(_el, currentScreenshot);
          options.initialScreenshot = Screenshots.get(screenshotName);
          options.currentScreenshot = currentScreenshot.path;
        },
      }),
    );
    for (const hiddenSelector of withHidden) {
      cy.get(hiddenSelector).invoke("css", "visibility", "");
    }

    cy.task("compareScreenshots", options, { log: false }).then((result) => {
      if (!result) {
        const error = new Error(
          `Screenshot comparison failed: ${compare} - expected ${compare === "shouldChange" ? "changes" : "no changes"} but got the opposite. Check that visual states are properly rendered in your test environment.`,
        );

        log.error(error);
        throw error;
      }
      Screenshots.delete(screenshotName);
    });

    log.end();
    return obj;
  },
);
