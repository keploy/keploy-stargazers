const fs = require("fs");
const fetch = require("node-fetch");
require("dotenv").config();

const GITHUB_API_URL = "https://api.github.com";
const REPO_PATH = "keploy/keploy";
const OUTPUT_FILE_ALL = "data/stargazers.json";
const OUTPUT_FILE_24H = "data/stargazers_last_24h.json";

let GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const last24Hours = process.argv.includes("last24h");

async function fetchStargazers() {
  if (!GITHUB_TOKEN) {
    console.error("❌ GitHub token is missing! Set it in the .env file or pass it as an environment variable.");
    process.exit(1);
  }

  let stargazers = [];
  let page = 1;
  let hasMore = true;
  const last24hTimestamp = new Date();
  last24hTimestamp.setDate(last24hTimestamp.getDate() - 1);

  console.log(`🔄 Fetching stargazers for repository: ${REPO_PATH} ${last24Hours ? "(Last 24 Hours)" : ""}`);

  while (hasMore) {
    try {
      console.log(`📄 Fetching page ${page}...`);

      const response = await fetch(
        `${GITHUB_API_URL}/repos/${REPO_PATH}/stargazers?page=${page}&per_page=100`,
        {
          headers: {
            "Authorization": `token ${GITHUB_TOKEN}`,
            "Accept": "application/vnd.github.v3.star+json",
          },
        }
      );

      if (!response.ok) {
        console.error(`❌ API Error (Page ${page}): ${response.status} - ${await response.text()}`);
        if (response.status === 403) console.error("🚨 API rate limit exceeded.");
        break;
      }

      const data = await response.json();
      if (!Array.isArray(data)) {
        console.error("❌ Unexpected response from GitHub API. Check your token and API permissions.");
        break;
      }

      let fetchedStargazers = data
        .filter(star => star.user) // Ensure user data exists
        .map(star => ({
          username: star.user?.login || "N/A",
          profile_url: star.user?.html_url || "N/A",
          starred_at: star.starred_at,
        }));

      if (last24Hours) {
        fetchedStargazers = fetchedStargazers.filter(star => new Date(star.starred_at) >= last24hTimestamp);
      }

      stargazers = [...stargazers, ...fetchedStargazers];
      hasMore = data.length === 100;
      page++;

      if (!hasMore) {
        console.log("🎉 Finished fetching all stargazers.");
      }
    } catch (error) {
      console.error("❌ Fetch Error:", error);
      break;
    }
  }

  const outputFile = last24Hours ? OUTPUT_FILE_24H : OUTPUT_FILE_ALL;
  fs.mkdirSync("data", { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(stargazers, null, 2));

  console.log(`✅ Total Stargazers Fetched: ${stargazers.length}`);
  console.log(`💾 Data saved to ${outputFile}`);
}

function setTokenFromUserInput(token) {
  if (!token.trim()) {
    console.error("❌ Invalid token input.");
    return;
  }
  GITHUB_TOKEN = token.trim();
  console.log("🔑 GitHub Token Set!");
}

fetchStargazers().catch(console.error);

module.exports = { setTokenFromUserInput, fetchStargazers };