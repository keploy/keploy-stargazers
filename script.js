const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";

let GITHUB_TOKENS=[];


let currentTokenIndex = 0;
const DELAY_BETWEEN_REQUESTS = 2000;
const CACHE_KEY = "cachedStargazers";

// Helper: Rotate API Tokens
function getNextToken() {
  currentTokenIndex = (currentTokenIndex + 1) % GITHUB_TOKENS.length;
  return GITHUB_TOKENS[currentTokenIndex];
}

// Helper: Cache Stargazers
function cacheStargazers(stargazers) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(stargazers));
}

// Helper: Get Cached Stargazers
function getCachedStargazers() {
  return JSON.parse(localStorage.getItem(CACHE_KEY)) || [];
}

// Fetch Stargazers using GraphQL
async function fetchStargazers(repoPath, last24Hours = false) {

  let [owner, repo] = repoPath.split("/");
  let stargazers = [];
  let afterCursor = null;
  let githubToken = getNextToken();
  document.getElementById("loading").style.display = "block";

  try {
    while (true) {
      const query = {
        query: `
          query($owner: String!, $repo: String!, $after: String) {
            repository(owner: $owner, name: $repo) {
              stargazers(first: 100, after: $after) {
                edges {
                  node {
                    login
                    url
                    email
                    company
                    location
                    websiteUrl
                    twitterUsername
                    bio
                  }
                  starredAt
                }
                pageInfo {
                  endCursor
                  hasNextPage
                }
              }
            }
          }
        `,
        variables: { owner, repo, after: afterCursor ||null},
      };

      const response = await fetchWithBackoff(GITHUB_GRAPHQL_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(query),
      });

      const data = await response.json();
      if (!data.data || !data.data.repository) break;

      let fetchedStargazers = data.data.repository.stargazers.edges.map((s) => ({
        username: s.node.login,
        profile_url: s.node.url,
        email: s.node.email || "N/A",
        company: s.node.company || "N/A",
        location: s.node.location || "N/A",
        website: s.node.websiteUrl || "N/A",
        linkedin: extractLinkedIn(s.node),
        twitter: s.node.twitterUsername ? `https://twitter.com/${s.node.twitterUsername}` : "N/A",
        bio: s.node.bio || "N/A",
        starred_at: s.starredAt,
      }));

      if (last24Hours) {
        const last24hTimestamp = new Date();
        last24hTimestamp.setDate(last24hTimestamp.getDate() - 1);
        fetchedStargazers = fetchedStargazers.filter((s) => new Date(s.starred_at) >= last24hTimestamp);
      }

      stargazers = [...stargazers, ...fetchedStargazers];

      if (!data.data.repository.stargazers.pageInfo.hasNextPage) break;
      afterCursor = data.data.repository.stargazers.pageInfo.endCursor;
    }

    cacheStargazers(stargazers);
    generateCSV(stargazers);
    document.getElementById("download-link").style.display = "block";
  } catch (error) {
    console.error("Error fetching stargazers:", error);
    alert("Failed to fetch stargazers. Check the console.");
  } finally {
    console.log("🔹 Stargazers Data Fetched:", stargazers);

    document.getElementById("loading").style.display = "none";
  }
}

// Exponential Backoff for API Requests
async function fetchWithBackoff(url, options, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {

      const response = await fetch(url, options);
      if (response.status === 403) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }
      return response;
    } catch (error) {
      console.error(`Request failed, retrying... (${i + 1})`, error);
    }
  }
  throw new Error("Failed after retries");
}

// Extract LinkedIn from Website URL
function extractLinkedIn(user) {
  if (user.website && user.website.includes("linkedin.com")) {
    return user.website;
  }
  return "N/A";
}

// Convert Stargazers to CSV and Download
function generateCSV(stargazers) {
  const headers = ["Username", "GitHub URL", "Email", "Company", "Location", "Website", "LinkedIn", "Twitter", "Bio"];
  const rows = stargazers.map((s) => [
    s.username,
    s.profile_url,
    s.email,
    s.company,
    s.location,
    s.website,
    s.linkedin,
    s.twitter,
    s.bio,
  ]);

  const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "stargazers.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Event Listeners


document.getElementById("fetch-button").addEventListener("click", () => {
  const repoUrl = document.getElementById("repo-url").value;
  const repoPath = extractRepoPath(repoUrl);
  const tokenInput = document.getElementById("github-token");
  if (!tokenInput) return alert("GitHub token input not found!");

  GITHUB_TOKENS = tokenInput.value.trim().split(",").map(token=>token.trim());
  if (!repoPath) return alert("Invalid GitHub URL");
  fetchStargazers(repoPath, false);
});

document.getElementById("fetch-last-24h").addEventListener("click", () => {
  const repoUrl = document.getElementById("repo-url").value;
  const repoPath = extractRepoPath(repoUrl);
  const tokenInput = document.getElementById("github-token");
  if (!tokenInput) return alert("GitHub token input not found!");

  GITHUB_TOKENS = tokenInput.value.trim().split(",").map(token=>token.trim());

  if (!repoPath) return alert("Invalid GitHub URL");
  fetchStargazers(repoPath, true);
});

// Extract Repository Path
function extractRepoPath(url) {
  const match = url.match(/github\.com\/([^\/]+\/[^\/]+)/);
  return match ? match[1] : null;
}