// ==UserScript==
// @name     kt-cg-iidx-exporter
// @author   tranq
// @version  3
// @grant    none

// @match    https://dev.cardinal-gate.net/iidx/profile*
// @match    https://ganymede-cg.net/iidx/profile*
// @match    https://www.ganymede-cg.net/iidx/profile*
// @match    https://nageki-cg.net/iidx/profile*
// @match    https://www.nageki-cg.net/iidx/profile*

// @require  https://cdn.jsdelivr.net/npm/date-fns@3.6.0/cdn.min.js
// @require  https://cdn.jsdelivr.net/npm/file-saver@2.0.5/dist/FileSaver.min.js
// ==/UserScript==

(() => {
  "use strict";

  const SERVICE_NAME = "kt-cg-iidx-exporter";

  // do not abuse these!
  const SLEEP_TIME_BETWEEN_PAGES = 250;
  const PAGE_LIMIT = 10;

  const difficultyMap = {
    B: "BEGINNER",
    N: "NORMAL",
    H: "HYPER",
    A: "ANOTHER",
    L: "LEGGENDARIA",
  };

  /**
   * Send a message to the log under the export button.
   * @param {string} txt
   */
  function log(txt) {
    const statusNode = document.getElementById("export-status");
    const FORMAT = "hh:mm:ss.u";
    const dateText = dateFns.format(new Date(), FORMAT);
    statusNode.innerHTML += `[${dateText}] ${txt}\n`;
  }

  /**
   * Wait for `ms` milliseconds.
   * @param {number} ms
   * @returns {Promise<any>}
   */
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Return an object containing the current page number and the total number
   * of pages.
   * @returns { {currentPage: number; totalPages: number;} }
   */
  function getPageInfo() {
    const pageTextNode =
      document.querySelector(".score-grid").nextElementSibling;

    const result = {
      currentPage: 1,
      totalPages: 1,
    };

    if (pageTextNode) {
      result.currentPage = parseInt(pageTextNode.innerText.split(" ")[1]);
      result.totalPages = parseInt(pageTextNode.innerText.split(" ")[3]);
    }
    return result;
  }

  /**
   * Return an array containing the pages to be queried.
   * The first page is always the current page.
   * @returns {number[]}
   */
  function getPageQueue() {
    const pageInfo = getPageInfo();
    const result = [];

    for (let i = pageInfo.currentPage; i <= pageInfo.totalPages; i++) {
      if (result.length == PAGE_LIMIT) {
        break;
      }
      result.push(i);
    }

    return result;
  }

  /**
   * Convert a CG timestamp to unix milliseconds.
   * @param {string} date
   * @returns {number}
   */
  function parseDate(date) {
    date = date.replace("UTC", "+0000");
    if (date.match(/\w{3} \d{4}/g)) {
      return dateFns.parse(date, "do MMM y, H:mm xx", new Date()).getTime();
    }
    return dateFns.parse(date, "do MMM, H:mm xx", new Date()).getTime();
  }

  /**
   * Given the DOM of a page of scores, parse the scores into objects.
   * @param {Document} doc
   * @returns { {SP: object[]; DP: object[]} }
   */
  function fetchScores(doc) {
    const scores = {
      SP: [],
      DP: [],
    };

    const scoreDivs = doc
      .querySelector(".score-grid")
      .querySelectorAll(":scope > .grid-x");

    scoreDivs.forEach((div) => {
      const scoreObj = {
        matchType: "inGameID",
      };
      const cells = div.querySelectorAll(":scope > .cell");

      const difficulty =
        difficultyMap[
          cells[0].querySelectorAll("strong")[1].textContent.trim().slice(-1)
        ];
      // kt doesn't track beginner charts, so just ignore the score
      if (difficulty == "BEGINNER") {
        return;
      }

      scoreObj.identifier = cells[0].querySelector("a").href.split("/")[6];
      scoreObj.difficulty = difficulty;
      scoreObj.lamp = cells[0].querySelector(".label").textContent.trim();
      scoreObj.score = +cells[2]
        .querySelector("strong")
        .textContent.trim()
        .split(" ")[0]
        .replace(",", "");
      scoreObj.timeAchieved = parseDate(
        cells[2].querySelectorAll(".cell")[1].textContent.trim()
      );
      scoreObj.judgements = {
        pgreat: +cells[2]
          .querySelector("strong")
          .title.split(",")[0]
          .trim()
          .split(" ")[0],
        great: +cells[2]
          .querySelector("strong")
          .title.split(",")[1]
          .trim()
          .split(" ")[0],
      };

      const playstyle = cells[0]
        .querySelectorAll("strong")[1]
        .textContent.trim()
        .slice(0, 2);
      if (playstyle == "SP") {
        scores.SP.push(scoreObj);
      } else {
        scores.DP.push(scoreObj);
      }
    });

    return scores;
  }

  /**
   * Iterate over a set of pages and parse their scores.
   * @returns { Promise<{SP: object[]; DP: object[]}> }
   */
  async function fetchScoresForPages() {
    const pageQueue = getPageQueue();
    const parser = new DOMParser();
    const scores = {
      SP: [],
      DP: [],
    };

    for (let i = pageQueue.at(0); i <= pageQueue.at(-1); i++) {
      const url = document.URL.split("?")[0] + `?page=${i}`;
      log(`Fetching scores from ${url}`);
      const resp = await fetch(url);
      const doc = parser.parseFromString(await resp.text(), "text/html");
      const pageScores = fetchScores(doc);
      log(`    Fetched ${pageScores.SP.length} SP scores.`);
      log(`    Fetched ${pageScores.DP.length} DP scores.`);
      scores.SP = scores.SP.concat(pageScores.SP);
      scores.DP = scores.DP.concat(pageScores.DP);
      log(
        `Waiting ${SLEEP_TIME_BETWEEN_PAGES}ms to avoid overloading the website...`
      );
      await sleep(SLEEP_TIME_BETWEEN_PAGES);
    }

    log(
      `Fetched all scores from pages ${pageQueue.at(0)} to ${pageQueue.at(-1)}.`
    );
    return scores;
  }

  /**
   * Download all parsed scores to a JSON in BATCH-MANUAL format.
   */
  async function downloadScores() {
    const nowText = dateFns.format(new Date(), "yyyy-MM-dd-'at'-hh-mm-ss");
    const scores = await fetchScoresForPages();
    log(`Total SP: ${scores.SP.length}`);
    log(`Total DP: ${scores.DP.length}`);
    const batchJson = {
      meta: {
        game: "iidx",
        playtype: "SP",
        service: SERVICE_NAME,
      },
      scores: scores.SP,
    };

    let blob;
    const blobType = "application/json;charset=utf-8";
    if (scores.SP.length > 0) {
      log("Generating SP file...");
      blob = new Blob([JSON.stringify(batchJson, null, 2)], { type: blobType });
      saveAs(blob, `export-cg-iidx-sp-${nowText}.json`);
    }
    if (scores.DP.length > 0) {
      batchJson.meta.playtype = "DP";
      batchJson.scores = scores.DP;

      log("Generating DP file...");
      blob = new Blob([JSON.stringify(batchJson, null, 2)], { type: blobType });
      saveAs(blob, `export-cg-iidx-dp-${nowText}.json`);
    }

    log("Done!");
    const kamaiLink =
      `<a href="https://kamai.tachi.ac/import/batch-manual" target="_blank">` +
      `https://kamai.tachi.ac/import/batch-manual` +
      `</a>`;
    log(`File(s) should be ready to be uploaded to ${kamaiLink}.`);
  }

  /**
   * Create an export button next to the Update button.
   */
  function createExportButton() {
    const kamaiColor = "#e61c6e";
    const panelFooterRow = document.querySelector("form .panel tfoot tr");
    const updateButton = panelFooterRow.querySelector('input[value="Update"]');
    const exportButton = updateButton.cloneNode();

    exportButton.setAttribute("type", "button");
    exportButton.setAttribute("name", "export");
    const pageQueue = getPageQueue();
    exportButton.value = `Export pages ${pageQueue.at(0)}-${pageQueue.at(-1)}`;
    exportButton.style.backgroundColor = kamaiColor;
    exportButton.style.margin = "0 1em";

    updateButton.after(exportButton);

    const exportStatus = document.createElement("td");
    exportStatus.id = "export-status";
    exportStatus.setAttribute("colspan", 2);
    exportStatus.style.whiteSpace = "pre";
    const exportStatusRow = document.createElement("tr");
    panelFooterRow.after(exportStatusRow);
    exportStatusRow.append(exportStatus);

    exportButton.onclick = async () => {
      await downloadScores();
    };
  }

  createExportButton();
})();
