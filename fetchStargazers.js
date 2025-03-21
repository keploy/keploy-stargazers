const fs = require("fs");
const fetch = require("node-fetch");

const GITHUB_API_URL = "https://api.github.com";
const REPO_PATH = "keploy/keploy"; // Change if needed
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OUTPUT_FILE_ALL = "data/stargazers.json";
const OUTPUT_FILE_24H = "data/stargazers_last_24h.json";

// Check for command-line argument (e.g., "node fetchStargazers.js last24h")
const last24Hours = process.argv.includes("last24h");

async function fetchStargazers() {
  let stargazers = [];
  let page = 1;
  let hasMore = true;

  const last24hTimestamp = new Date();
  last24hTimestamp.setDate(last24hTimestamp.getDate() - 1);

  while (hasMore) {
    const response = await fetch(
      `${GITHUB_API_URL}/repos/${REPO_PATH}/stargazers?page=${page}&per_page=100`,
      {
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github.v3.star+json",
        },
      }
    );

    if (!response.ok) {
      console.error(`Failed to fetch page ${page}:`, response.statusText);
      break;
    }

    const data = await response.json();

    if (last24Hours) {
      // ✅ Filter only stargazers from the last 24 hours
      const filteredData = data.filter(star => new Date(star.starred_at) >= last24hTimestamp);
      stargazers = stargazers.concat(filteredData);
    } else {
      // ✅ Fetch all stargazers
      stargazers = stargazers.concat(data);
    }

    hasMore = data.length === 100; // Continue fetching if there are more pages
    page++;
  }

  const outputFile = last24Hours ? OUTPUT_FILE_24H : OUTPUT_FILE_ALL;
  fs.writeFileSync(outputFile, JSON.stringify(stargazers, null, 2));

  console.log(`Fetched ${stargazers.length} stargazers${last24Hours ? " from the last 24 hours" : ""}.`);
}

// Run script
fetchStargazers().catch(console.error);
