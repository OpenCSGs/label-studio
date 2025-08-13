const { I } = inject();
const Helpers = require("../tests/helpers");

module.exports = {
  _rootSelector: ".lsf-paragraphs",
  _filterSelector: "button[data-testid*='select-trigger']",
  _phraseSelector: "[class^='phrase--']",
  _phraseDialoguetextSelector: "[class^='dialoguetext--']",

  getParagraphTextSelector(idx) {
    return `${this._rootSelector} ${this._phraseSelector}:nth-child(${idx}) ${this._phraseDialoguetextSelector}`;
  },

  selectTextByOffset(paragraphIdx, startOffset, endOffset) {
    I.executeScript(Helpers.selectText, {
      selector: this.getParagraphTextSelector(paragraphIdx),
      rangeStart: startOffset,
      rangeEnd: endOffset,
    });
  },
  setSelection(startLocator, startOffset, endLocator, endOffset) {
    I.setSelection(startLocator, startOffset, endLocator, endOffset);
  },
  locate(locator) {
    return locator ? locate(locator).inside(this.locateRoot()) : this.locateRoot();
  },
  locateRoot() {
    return locate(this._rootSelector);
  },
  locateText(text) {
    const locator = locate(
      `${this.locateRoot().toXPath()}//*[starts-with(@class,'phrase--')]//*[contains(@class,'text--')]//text()[contains(.,'${text}')]`,
    );

    return locator;
  },

  clickFilter(...authors) {
    // Open dropdown and wait for it to appear
    I.click(locate(this._filterSelector));
    I.waitTicks(1);
    // For the new select component, we need to select each author
    // and the dropdown is managed automatically
    for (const author of authors) {
      // We may or may not have a search field depending on number of options
      const hasSearchField = I.executeScript(() => {
        return !!document.querySelector("input[data-testid='select-search-field']");
      });

      if (hasSearchField) {
        // Try to search if field is available
        I.fillField(locate("input[data-testid='select-search-field']"), author);
        I.waitTicks(3);
      }

      // Select the author option
      I.click(locate(`div[data-testid='select-option-${author}']`));
      I.waitTicks(3);
    }

    // Close any open dropdown
    I.pressKey("Escape");
    I.waitTicks(3); // Wait for UI to update after filter change
  },
};
