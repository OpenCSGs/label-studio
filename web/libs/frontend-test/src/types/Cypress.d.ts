declare namespace Cypress {
  interface Thresholdable {
    threshold?: number;
  }
  interface CompareScreenshotOptions extends ScreenshotOptions {
    withHidden: string[];
  }
  interface Chainable {
    /**
     * Custom command to select DOM element by data-cy attribute.
     * @example cy.dataCy('greeting')
     */
    captureScreenshot(
      name: string,
      screenshotCaptureOptions?: Partial<Loggable & Timeoutable & CompareScreenshotOptions>,
    ): Chainable<JQuery<Element>>;
    compareScreenshot(
      name: string,
      assert: "shouldChange" | "shouldNotChange" | "diff",
      screenshotCompareOptions?: Partial<Loggable & Timeoutable & CompareScreenshotOptions & Thresholdable>,
    ): Chainable<JQuery<Element>>;
    matchImageSnapshot(options?: { name?: string; threshold?: number }): Chainable<JQuery<Element>>;
  }
}
